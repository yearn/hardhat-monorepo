import { run, ethers, network } from 'hardhat';
import { e18, ZERO_ADDRESS } from '../../../utils/web3-utils';
import * as contracts from '../../../utils/contracts';
import * as accounts from '../../../utils/accounts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { v2FtmHarvestStrategies } from '../../../utils/v2-ftm-strategies';

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
    const [owner] = await ethers.getSigners();
    let signer = owner;
    if (owner.address != accounts.yKeeper) {
      console.log('on fork mode, impersonating yKeeper');
      await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [accounts.yKeeper],
      });
      const yKeeper: any = ethers.provider.getUncheckedSigner(accounts.yKeeper) as any as SignerWithAddress;
      yKeeper.address = yKeeper._address;
      signer = yKeeper;
    }

    console.log('using address:', signer.address);
    prompt.run().then(async (answer: any) => {
      if (answer) {
        try {
          const harvestV2DetachedJob = await ethers.getContractAt('IV2DetachedJobDeprecated', contracts.harvestV2DetachedJob.fantom, signer);

          const jobStrategies = await harvestV2DetachedJob.callStatic.strategies();

          const strategiesAdded = v2FtmHarvestStrategies.filter((strategy) => strategy.added).map((strategy) => strategy.address);

          const strategiesNotYetAdded = v2FtmHarvestStrategies.filter((strategy) => !strategy.added).map((strategy) => strategy.address);

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

          const strategiesToAdd = v2FtmHarvestStrategies
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

          await harvestV2DetachedJob.callStatic.addStrategies(
            strategiesToAdd.map((strategy) => strategy.address), // address _strategy,
            // strategiesToAdd.map(() => 0), // address _requiredAmount,
            strategiesToAdd.map((strategy) => strategy.costToken), // address _costToken,
            strategiesToAdd.map((strategy) => strategy.costPair) // address _costPair
          );
          await harvestV2DetachedJob.addStrategies(
            strategiesToAdd.map((strategy) => strategy.address), // address _strategy,
            // strategiesToAdd.map(() => 0), // address _requiredAmount,
            strategiesToAdd.map((strategy) => strategy.costToken), // address _costToken,
            strategiesToAdd.map((strategy) => strategy.costPair) // address _costPair
          );

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
