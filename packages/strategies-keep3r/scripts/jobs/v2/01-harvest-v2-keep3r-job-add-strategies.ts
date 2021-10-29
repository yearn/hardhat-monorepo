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
    console.log('adding strategies on HarvestV2Keep3rJob contract');
    try {
      // Setup HarvestV2Keep3rJob
      const oldHarvestV2Keep3rJob = await ethers.getContractAt('HarvestV2Keep3rJob', mainnetContracts.oldJobs.harvestV2Keep3rJob);
      // const strategies = [
      //   {
      //     address: '0x979843b8eea56e0bea971445200e0ec3398cdb87',
      //     requiredAmount: null,
      //   },
      //   {
      //     address: '0x4d7d4485fd600c61d840ccbec328bfd76a050f87',
      //     requiredAmount: null,
      //   },
      //   {
      //     address: '0x4031afd3b0f71bace9181e554a9e680ee4abe7df',
      //     requiredAmount: null,
      //   },
      //   {
      //     address: '0xee697232df2226c9fb3f02a57062c4208f287851',
      //     requiredAmount: null,
      //   },
      //   {
      //     address: '0x32b8c26d0439e1959cea6262cbabc12320b384c4',
      //     requiredAmount: null,
      //   },
      //   {
      //     address: '0xb5f6747147990c4ddcebbd0d4ef25461a967d079',
      //     requiredAmount: null,
      //   },
      // ];
      const strategiesAddresses = await oldHarvestV2Keep3rJob.strategies();
      const strategies = strategiesAddresses.map((address: string) => ({
        address,
      }));

      for (const strategy of strategies) {
        strategy.requiredAmount = await oldHarvestV2Keep3rJob.requiredAmount(strategy.address);
      }

      const harvestV2Keep3rJob = await ethers.getContractAt('HarvestV2Keep3rJob', mainnetContracts.jobs.harvestV2Keep3rJob);

      console.log(
        strategies.map((strategy: { address: string }) => strategy.address),
        strategies.map((strategies: { requiredAmount: any }) => (strategies.requiredAmount as any).toString())
      );
      if (!(await confirm.run())) return;

      // Add harvest strategies
      await harvestV2Keep3rJob.addStrategies(
        strategies.map((strategy: { address: string }) => strategy.address),
        strategies.map((strategies: { requiredAmount: any }) => strategies.requiredAmount)
      );

      resolve();
    } catch (err) {
      reject(`Error while adding strategies on HarvestV2Keep3rJob contract: ${err.message}`);
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
