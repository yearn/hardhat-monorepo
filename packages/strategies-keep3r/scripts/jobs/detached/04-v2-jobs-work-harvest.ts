import moment from 'moment';
import { HarvestV2DetachedJob, HarvestV2DetachedJob__factory, IBaseStrategy__factory } from '@typechained';
import { ethers } from 'hardhat';
import * as contracts from '../../../utils/contracts';
import { HarvestConfiguration, harvestConfigurations } from '../../../utils/v2-ftm-strategies';
import * as gasprice from '../../../utils/ftm-gas-price';
import { BigNumber, utils } from 'ethers';

let harvestV2DetachedJob: HarvestV2DetachedJob;
const worked: string[] = [];
const notWorkable: string[] = [];
const errorWhileWorked: string[] = [];
const lastTimeRewardWasDumped: { [address: string]: number } = {};

// FIX: This might make lats strats on the array never be worked
const REWARD_DUMPED_COOLDOWN = moment.duration('0', 'minutes');

async function main() {
  const [harvester] = await ethers.getSigners();
  const networkName = 'fantom';
  await gasprice.start();
  console.time('[App] Executed in');
  console.log('[App] Using address', harvester.address, 'on fantom');
  console.log('[App] Block', await ethers.provider.getBlockNumber());

  harvestV2DetachedJob = await HarvestV2DetachedJob__factory.connect(contracts.harvestV2DetachedJob[networkName], harvester);

  const now = moment().unix();

  const workCooldown = (await harvestV2DetachedJob.workCooldown()).toNumber();

  console.log('[App] Work cooldown', moment.duration(workCooldown, 'seconds').humanize());

  const strategies = await harvestV2DetachedJob.strategies();

  // Get all last worked at
  const lastWorksAt = (await Promise.all(strategies.map((strategy) => harvestV2DetachedJob.lastWorkAt(strategy)))).map((timestampBn) =>
    timestampBn.toNumber()
  );

  // Map when was the last time a reward token was dumped
  lastWorksAt.forEach((lastWorkAt: number, i: number) => {
    const harvestConfiguration: HarvestConfiguration | undefined = harvestConfigurations.find(
      (harvestConfiguration) => harvestConfiguration.address.toLowerCase() === strategies[i].toLowerCase()
    );
    if (!harvestConfiguration) throw new Error('Mismatch between harvests configuration and job strategies');
    harvestConfiguration.tokensBeingDumped.forEach((tokenBeingDumped) => {
      if (!lastTimeRewardWasDumped.hasOwnProperty(tokenBeingDumped) || lastWorkAt > lastTimeRewardWasDumped[tokenBeingDumped]) {
        lastTimeRewardWasDumped[tokenBeingDumped] = lastWorkAt;
      }
    });
  });

  // Get all workable
  const workable = await Promise.all(strategies.map((strategy) => harvestV2DetachedJob.workable(strategy)));

  // Calculating cooldowns
  const onWorkCooldown = lastWorksAt.map((lastWorkAt) => lastWorkAt + workCooldown > now);

  // Get all harvest trigger
  const harvestTrigger = await Promise.all(
    strategies.map(async (strategy) => {
      const strategyContract = IBaseStrategy__factory.connect(strategy, harvester);
      return strategyContract.harvestTrigger(1);
    })
  );

  console.log('***************************');
  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    console.log('[App] Checking strategy', strategy);
    try {
      const strategyHarvestConfiguration: HarvestConfiguration = harvestConfigurations.find(
        (harvestConfiguration) => harvestConfiguration.address.toLowerCase() === strategy.toLowerCase()
      )!;
      let isStratOnLiquidityCooldown: boolean = false;
      strategyHarvestConfiguration.tokensBeingDumped.forEach((tokenBeingDumped) => {
        isStratOnLiquidityCooldown =
          isStratOnLiquidityCooldown || moment().subtract(REWARD_DUMPED_COOLDOWN).unix() <= lastTimeRewardWasDumped[tokenBeingDumped];
      });
      if (!workable[i] || isStratOnLiquidityCooldown) {
        console.log('[App] Not workable');
        console.log('[App] Harvest trigger status is', harvestTrigger[i]);
        console.log('[App] Is it on work cooldown?', onWorkCooldown[i]);
        console.log('[App] Is it on liquidity cooldown?', isStratOnLiquidityCooldown);
        notWorkable.push(strategy);
      } else {
        console.log('[App] Working...');
        const gasLimit = await harvestV2DetachedJob.estimateGas.work(strategy);
        await harvestV2DetachedJob.callStatic.work(strategy, {
          gasLimit: gasLimit.mul(110).div(100),
          gasPrice: utils.parseUnits(`${gasprice.get()}`, 'gwei'),
        });
        const tx = await harvestV2DetachedJob.work(strategy, {
          gasLimit: gasLimit.mul(110).div(100),
          gasPrice: utils.parseUnits(`${gasprice.get()}`, 'gwei'),
        });
        strategyHarvestConfiguration.tokensBeingDumped.forEach((tokenBeingDumped) => {
          lastTimeRewardWasDumped[tokenBeingDumped] = moment().unix();
        });
        worked.push(strategy);
        console.log(`[App] Check work tx at https://ftmscan.com/tx/${tx.hash} at ${moment()} (${moment().unix()})`);
      }
    } catch (error: any) {
      console.log('[App] Error while working:', error.message);
      errorWhileWorked.push(strategy);
    }
    console.log('***************************');
  }
  console.log('[App] Not workable strategies:', notWorkable.join(','));
  console.log('***************************');
  console.log('[App] Worked strategies:', worked.join(','));
  console.log('***************************');
  console.log('[App] Errored while working:', errorWhileWorked.join(','));
  console.timeEnd('[App] Executed in');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
