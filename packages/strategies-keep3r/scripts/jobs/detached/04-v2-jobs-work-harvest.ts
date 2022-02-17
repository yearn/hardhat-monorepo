import moment from 'moment';
import { HarvestV2DetachedGaslessJob, IBaseStrategy__factory } from '@typechained';
import { ethers } from 'hardhat';
import * as gasprice from '../../../utils/ftm-gas-price';
import { utils } from 'ethers';

let harvestV2DetachedJob: HarvestV2DetachedGaslessJob;
const worked: string[] = [];
const notWorkable: string[] = [];
const errorWhileWorked: string[] = [];

const MAX_GAS_PRICE = utils.parseUnits('1000', 'gwei');

async function main() {
  const [harvester] = await ethers.getSigners();
  await gasprice.start();
  console.time('[App] Executed in');
  console.log('[App] Using address', harvester.address, 'on fantom');
  console.log('[App] Block', await ethers.provider.getBlockNumber());

  harvestV2DetachedJob = await ethers.getContract<HarvestV2DetachedGaslessJob>('HarvestV2DetachedGaslessJob');

  const now = moment().unix();

  const workCooldown = (await harvestV2DetachedJob.workCooldown()).toNumber();

  console.log('[App] Work cooldown', moment.duration(workCooldown, 'seconds').humanize());

  const callCost = await harvestV2DetachedJob.callCost();

  console.log('[App] Call cost', utils.formatEther(callCost), 'ether');

  const strategies = await harvestV2DetachedJob.strategies();

  // Get all last worked at
  const lastWorksAt = (await Promise.all(strategies.map((strategy) => harvestV2DetachedJob.lastWorkAt(strategy)))).map((timestampBn) =>
    timestampBn.toNumber()
  );

  // Get all workable
  const workable = await Promise.all(strategies.map((strategy) => harvestV2DetachedJob.workable(strategy)));

  // Calculating cooldowns
  const onWorkCooldown = lastWorksAt.map((lastWorkAt) => lastWorkAt + workCooldown > now);

  // Get all harvest trigger
  const harvestTrigger = await Promise.all(
    strategies.map(async (strategy) => {
      const strategyContract = IBaseStrategy__factory.connect(strategy, harvester);
      return strategyContract.harvestTrigger(callCost);
    })
  );

  console.log('***************************');
  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    console.log('[App] Checking strategy', strategy);
    try {
      if (!workable[i]) {
        console.log('[App] Not workable');
        console.log('[App] Harvest trigger status is', harvestTrigger[i]);
        console.log('[App] Is it on work cooldown?', onWorkCooldown[i]);
        notWorkable.push(strategy);
      } else {
        console.log('[App] Working...');
        const gasLimit = await harvestV2DetachedJob.estimateGas.work(strategy);
        const gasPrice = utils.parseUnits(`${gasprice.get()}`, 'gwei');
        if (gasPrice.gt(MAX_GAS_PRICE)) {
          console.log('[App] Skipping because gas price is', gasprice.get());
          continue;
        }
        await harvestV2DetachedJob.callStatic.work(strategy, {
          gasLimit: gasLimit.mul(110).div(100),
          gasPrice: utils.parseUnits(`${gasprice.get()}`, 'gwei'),
        });
        const tx = await harvestV2DetachedJob.work(strategy, {
          gasLimit: gasLimit.mul(110).div(100),
          gasPrice: utils.parseUnits(`${gasprice.get()}`, 'gwei'),
        });
        worked.push(strategy);
        console.log(`[App] Check work tx at https://ftmscan.com/tx/${tx.hash} sent ${moment()} (${moment().unix()})`);
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
