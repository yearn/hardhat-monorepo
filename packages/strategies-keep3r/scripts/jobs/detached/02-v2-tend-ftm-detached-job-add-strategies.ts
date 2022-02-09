import { run, ethers } from 'hardhat';
import { ZERO_ADDRESS } from '../../../utils/web3-utils';
import * as contracts from '../../../utils/contracts';
import { tendConfigurations } from '../../../utils/v2-ftm-strategies';

const { Confirm } = require('enquirer');
const prompt = new Confirm({ message: 'correct address?' });
const confirm = new Confirm({
  message: 'Do you want to add strategies to v2 ftm tend detached job?',
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
          const tendV2DetachedJob = await ethers.getContractAt('IV2DetachedJobDeprecated', contracts.tendV2DetachedJob.fantom);

          const jobStrategies = (await tendV2DetachedJob.callStatic.strategies()).map((strategy: string) => strategy.toLowerCase());

          const strategiesAdded = tendConfigurations.filter((strategy) => strategy.added).map((strategy) => strategy.address.toLowerCase());

          const strategiesNotYetAdded = tendConfigurations
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

          const strategiesToAdd = tendConfigurations
            .filter((strategy) => !strategy.added)
            .map((strategy) => ({
              name: strategy.name,
              address: strategy.address,
              costToken: strategy.costToken ? strategy.costToken : ZERO_ADDRESS,
              costPair: strategy.costPair ? strategy.costPair : ZERO_ADDRESS,
            }));

          console.log('strategiesToAdd');
          console.log(strategiesToAdd);
          if (!(await confirm.run())) return;

          await tendV2DetachedJob.callStatic.addStrategies(
            strategiesToAdd.map((strategy) => strategy.address), // address _strategy,
            strategiesToAdd.map((strategy) => strategy.costToken), // address _costToken,
            strategiesToAdd.map((strategy) => strategy.costPair) // address _costPair
          );
          await tendV2DetachedJob.addStrategies(
            strategiesToAdd.map((strategy) => strategy.address), // address _strategy,
            strategiesToAdd.map((strategy) => strategy.costToken), // address _costToken,
            strategiesToAdd.map((strategy) => strategy.costPair) // address _costPair
          );

          resolve();
        } catch (err: any) {
          reject(`Error while adding strategies to v2 tend detached job: ${err.message}`);
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
