import { ContractFactory } from 'ethers';
import { run, ethers } from 'hardhat';
import { bnToDecimal } from '../../../utils/web3-utils';
import config from '../../../contracts.json';
import { v1CrvStrategies } from '../../../utils/v1-crv-strategies';
const mainnetContracts = config.contracts.mainnet;

async function main() {
  await run('compile');
  await promptAndSubmit();
}

function promptAndSubmit(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    console.log('');
    try {
      // Setup CrvStrategyKeep3rJob
      const crvStrategyKeep3rJob = await ethers.getContractAt('CrvStrategyKeep3rJob', mainnetContracts.proxyJobs.crvStrategyKeep3rJob);

      const strategies = await crvStrategyKeep3rJob.callStatic.strategies();

      for (const strategy of strategies) {
        const requiredHarvest = await crvStrategyKeep3rJob.callStatic.requiredHarvest(strategy);
        const requiredEarn = await crvStrategyKeep3rJob.callStatic.requiredEarn(strategy);
        const strategyData = v1CrvStrategies.find((strategyData: any) => strategyData.address == strategy);
        console.log(strategyData?.name, strategy, requiredHarvest.toString(), requiredEarn.toString());
      }
      resolve();
    } catch (err) {
      reject(`Error while checking workable strategies on CrvStrategyKeep3rJob contract: ${err.message}`);
    }
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
