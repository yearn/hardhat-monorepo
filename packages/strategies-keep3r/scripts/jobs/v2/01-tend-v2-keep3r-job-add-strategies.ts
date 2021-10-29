import { run, ethers } from 'hardhat';
import config from '../../../contracts.json';
const mainnetContracts = config.contracts.mainnet;

const { Confirm } = require('enquirer');
const confirm = new Confirm({
  message: 'Do you want to add strategies to v2-harvest keep3r job?',
});

async function main() {
  await run('compile');
  await promptAndSubmit();
}

function promptAndSubmit(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    console.log('adding strategies on TendV2Keep3rJob contract');
    try {
      // Setup TendV2Keep3rJob
      const oldTendV2Keep3rJob = await ethers.getContractAt('TendV2Keep3rJob', mainnetContracts.oldJobs.tendV2Keep3rJob);
      const strategiesAddresses = await oldTendV2Keep3rJob.strategies();
      const strategies = strategiesAddresses.map((address: string) => ({
        address,
      }));

      for (const strategy of strategies) {
        strategy.requiredAmount = await oldTendV2Keep3rJob.requiredAmount(strategy.address);
      }

      const tendV2Keep3rJob = await ethers.getContractAt('TendV2Keep3rJob', mainnetContracts.jobs.tendV2Keep3rJob);

      console.log(
        strategies.map((strategy: { address: string }) => strategy.address),
        strategies.map((strategies: { requiredAmount: any }) => (strategies.requiredAmount as any).toString())
      );
      if (!(await confirm.run())) return;

      // Add harvest strategies
      await tendV2Keep3rJob.addStrategies(
        strategies.map((strategy: { address: string }) => strategy.address),
        strategies.map((strategies: { requiredAmount: any }) => strategies.requiredAmount)
      );

      resolve();
    } catch (err) {
      reject(`Error while adding strategies on TendV2Keep3rJob contract: ${err.message}`);
    }
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
