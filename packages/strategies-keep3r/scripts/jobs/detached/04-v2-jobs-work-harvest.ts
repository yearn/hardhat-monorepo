import moment from 'moment';
import { HarvestV2DetachedJob, HarvestV2DetachedJob__factory } from '@typechained';
import { ethers } from 'hardhat';
import * as contracts from '../../../utils/contracts';
import { HarvestConfiguration, harvestConfigurations } from '../../../utils/v2-ftm-strategies';

let harvestV2DetachedJob: HarvestV2DetachedJob;
const worked: string[] = [];
const notWorkable: string[] = [];
const onLiquidityCooldown: string[] = [];
const errorWhileWorked: string[] = [];
const lastTimeRewardWasDumped: { [address: string]: number } = {};

const REWARD_DUMPED_COOLDOWN = moment.duration('5', 'minutes');

async function main() {
  const [harvester] = await ethers.getSigners();
  const networkName = 'fantom';
  console.log('Using address:', harvester.address, 'on fantom');

  harvestV2DetachedJob = await HarvestV2DetachedJob__factory.connect(contracts.harvestV2DetachedJob[networkName], harvester);
  const strategies = await harvestV2DetachedJob.callStatic.strategies();

  // Get all last worked at
  const lastWorksAt = await Promise.all(strategies.map((strategy) => getLastWorkAt(strategy)));

  // Map when was the last time a reward token was dumped
  lastWorksAt.forEach((lastWorkAt) => {
    const harvestConfiguration: HarvestConfiguration | undefined = harvestConfigurations.find(
      (harvestConfiguration) => harvestConfiguration.address.toLowerCase() === lastWorkAt.strategy.toLowerCase()
    );
    if (!harvestConfiguration) throw new Error('Mismatch between harvests configuration and job strategies');
    if (
      !lastTimeRewardWasDumped.hasOwnProperty(harvestConfiguration.rewards) ||
      lastWorkAt.timestamp > lastTimeRewardWasDumped[harvestConfiguration.rewards]
    ) {
      lastTimeRewardWasDumped[harvestConfiguration.rewards] = lastWorkAt.timestamp;
    }
  });

  for (const strategy of strategies) {
    console.log('Checking strategy', strategy);
    try {
      const strategyHarvestConfiguration: HarvestConfiguration = harvestConfigurations.find(
        (harvestConfiguration) => harvestConfiguration.address.toLowerCase() === strategy.toLowerCase()
      )!;
      const rewardLastDumpedAt = lastTimeRewardWasDumped[strategyHarvestConfiguration.rewards];
      const workable = await harvestV2DetachedJob.callStatic.workable(strategy);
      if (!workable) {
        console.log('Not workable');
        console.log('***************************');
        notWorkable.push(strategy);
        continue;
      }
      if (moment().subtract(REWARD_DUMPED_COOLDOWN).unix() <= rewardLastDumpedAt) {
        console.log('On liquidity cooldown');
        console.log('***************************');
        onLiquidityCooldown.push(strategy);
        continue;
      }
      console.log('Working...');
      const gasLimit = await harvestV2DetachedJob.estimateGas.work(strategy);
      const tx = await harvestV2DetachedJob.work(strategy, { gasLimit: gasLimit.mul(110).div(100) });
      lastTimeRewardWasDumped[strategyHarvestConfiguration.rewards] = moment().unix();
      worked.push(strategy);
      console.log(`Check work tx at https://ftmscan.com/tx/${tx.hash}`);
    } catch (error: any) {
      console.log('Error while working:', error.message);
      errorWhileWorked.push(strategy);
    }
    console.log('***************************');
  }
  console.log('On liqudity cooldown:', onLiquidityCooldown.join(','));
  console.log('***************************');
  console.log('Not workable strategies:', notWorkable.join(','));
  console.log('***************************');
  console.log('Worked strategies:', worked.join(','));
  console.log('***************************');
  console.log('Errored while working:', errorWhileWorked.join(','));
}

const getLastWorkAt = async (strategy: string): Promise<{ strategy: string; timestamp: number }> => {
  return {
    strategy,
    timestamp: (await harvestV2DetachedJob.callStatic.lastWorkAt(strategy)).toNumber(),
  };
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
