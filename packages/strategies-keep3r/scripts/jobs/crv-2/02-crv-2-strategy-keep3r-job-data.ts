import { run, ethers } from 'hardhat';
import { v2CrvStrategies } from '../../../utils/v2-crv-strategies';
import { v1CrvStrategies } from '../../../utils/v1-crv-strategies';
import * as contracts from '../../../utils/contracts';

async function main() {
  await run('compile');
  await promptAndSubmit();
}

function promptAndSubmit(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    console.log('');
    try {
      // Setup CrvStrategyKeep3rStealthJob2
      const crvStrategyKeep3rStealthJob2 = await ethers.getContractAt(
        'CrvStrategyKeep3rStealthJob2',
        contracts.crvStrategyKeep3rStealthJob2.mainnet
      );

      const crvStrategies = [...v2CrvStrategies, ...v1CrvStrategies];

      const strategies = await crvStrategyKeep3rStealthJob2.callStatic.strategies();

      for (const strategy of strategies) {
        const requiredHarvest = await crvStrategyKeep3rStealthJob2.callStatic.requiredHarvest(strategy);
        const requiredEarn = await crvStrategyKeep3rStealthJob2.callStatic.requiredEarn(strategy);
        const strategyData = crvStrategies.find((strategyData: any) => strategyData.address == strategy);
        const strategyContract = await ethers.getContractAt('IBaseStrategy', strategy);
        const profitFactor = await strategyContract.profitFactor();
        const want = await strategyContract.callStatic.want();
        const wantContract = await ethers.getContractAt(
          'IV1Vault', // Using vault as detailed IERC20
          want
        );
        const symbol = await wantContract.callStatic.symbol();

        console.log(strategyData?.name, symbol, strategy, requiredHarvest.toString(), requiredEarn.toString(), profitFactor.toString());
      }
      resolve();
    } catch (err) {
      reject(`Error while checking workable strategies on CrvStrategyKeep3rStealthJob2 contract: ${err.message}`);
    }
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
