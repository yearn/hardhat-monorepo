import { run, ethers } from 'hardhat';
import { ZERO_ADDRESS } from '../../../utils/web3-utils';
import { harvestConfigurations } from '../../../utils/v2-ftm-strategies';
import { HarvestV2DetachedGaslessJob } from '@typechained';

const { Confirm } = require('enquirer');
const prompt = new Confirm({ message: 'correct address?' });
const confirm = new Confirm({
  message: 'Do you want to add strategies to v2 ftm harvest detached job?',
});
async function main() {
  await run('compile');
  await promptAndSubmit();
}

function promptAndSubmit(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    const [signer] = await ethers.getSigners();
    console.log('Using address:', signer.address);
    prompt.run().then(async (answer: any) => {
      if (answer) {
        try {
          const harvestV2DetachedJob = await ethers.getContract<HarvestV2DetachedGaslessJob>('HarvestV2DetachedGaslessJob');

          const jobStrategies = (await harvestV2DetachedJob.callStatic.strategies()).map((strategy: string) => strategy.toLowerCase());

          const strategiesAdded = harvestConfigurations.filter((strategy) => strategy.added).map((strategy) => strategy.address.toLowerCase());

          const strategiesNotYetAdded = harvestConfigurations
            .filter((strategy) => !strategy.added)
            .map((strategy) => strategy.address.toLowerCase());

          for (const strategyAdded of strategiesAdded) {
            if (jobStrategies.indexOf(strategyAdded) == -1)
              console.log(`strategy: ${strategyAdded} should be added: false, or removed from config`);
          }

          for (const strategyNotYetAdded of strategiesNotYetAdded) {
            if (jobStrategies.indexOf(strategyNotYetAdded) != -1)
              console.log(`strategy: ${strategyNotYetAdded} should be added: true, or removed from job and config`);
          }

          for (const jobStrategy of jobStrategies) {
            if (strategiesAdded.indexOf(jobStrategy) == -1)
              console.log(`strategy: ${jobStrategy} should not be on job, or is missing from config`);
          }

          const strategiesToAdd = harvestConfigurations
            .filter((strategy) => !strategy.added)
            .map((strategy) => ({
              name: strategy.name,
              address: strategy.address,
            }));

          console.log('strategiesToAdd');
          console.log(strategiesToAdd);
          if (!(await confirm.run())) return;

          await harvestV2DetachedJob.callStatic.addStrategies(
            strategiesToAdd.map((strategy) => strategy.address) // address _strategy,
          );
          const tx = await harvestV2DetachedJob.addStrategies(
            strategiesToAdd.map((strategy) => strategy.address) // address _strategy,
          );
          console.log(`Tx submitted, track it on https://ftmscan.com/tx/${tx.hash}`);
          resolve();
        } catch (err: any) {
          reject(`Error while adding strategies to v2 harvest detached job: ${err.message}`);
        }
      } else {
        console.error('Aborted!');
        resolve();
      }
    });
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
