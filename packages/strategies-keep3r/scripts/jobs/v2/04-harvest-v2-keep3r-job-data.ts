import { run, ethers } from 'hardhat';
import config from '../../../contracts.json';
const mainnetContracts = config.contracts.mainnet;

async function main() {
  await run('compile');
  await promptAndSubmit();
}

function promptAndSubmit(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    console.log('checking strategies data on Harvest and Tend V2Keep3rJob contract');
    try {
      // Setup HarvestV2Keep3rJob
      console.log('HarvestV2Keep3rJob:');
      const harvestV2Keep3rJob = await ethers.getContractAt('V2Keep3rJob', mainnetContracts.oldJobs.harvestV2Keep3rJob);

      let strategies = await harvestV2Keep3rJob.callStatic.strategies();
      for (const strategy of strategies) {
        const requiredAmount = await harvestV2Keep3rJob.requiredAmount(strategy);
        const baseStrategy = await ethers.getContractAt('IBaseStrategy', strategy);
        const name = await baseStrategy.name();
        console.log(name, strategy, requiredAmount.toString());
      }
      // Setup TendV2Keep3rJob
      console.log('TendV2Keep3rJob:');
      const tendV2Keep3rJob = await ethers.getContractAt('TendV2Keep3rJob', mainnetContracts.oldJobs.tendV2Keep3rJob);

      strategies = await tendV2Keep3rJob.callStatic.strategies();
      for (const strategy of strategies) {
        const requiredAmount = await tendV2Keep3rJob.requiredAmount(strategy);
        const baseStrategy = await ethers.getContractAt('IBaseStrategy', strategy);
        const name = await baseStrategy.name();
        console.log(name, strategy, requiredAmount.toString());
      }
      resolve();
    } catch (err) {
      reject(`Error while checking strategies data on HarvestV2Keep3rJob contract: ${err.message}`);
    }
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
