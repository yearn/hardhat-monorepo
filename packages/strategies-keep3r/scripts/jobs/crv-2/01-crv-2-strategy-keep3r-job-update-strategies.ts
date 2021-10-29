import hre from 'hardhat';
import { bn } from '../../../utils/web3-utils';
const ethers = hre.ethers;
import { v2CrvStrategies } from '../../../utils/v2-crv-strategies';
import { v1CrvStrategies } from '../../../utils/v1-crv-strategies';
import config from '../../../.config.json';
import * as accounts from '../../../utils/accounts';
import * as contracts from '../../../utils/contracts';

const { Confirm } = require('enquirer');
const confirm = new Confirm('Do you want to modify strategies on crv keep3r job?');
const confirmAddStrategies = new Confirm('Do you want to add strategies on crv keep3r job?');

async function main() {
  await hre.run('compile');
  await run();
}

function run(): Promise<void | Error> {
  return new Promise(async (resolve) => {
    // Setup deployer
    const [owner] = await ethers.getSigners();
    let deployer: any;
    if (owner.address == accounts.yKeeper) {
      deployer = owner;
      deployer._address = owner.address;
    } else {
      await hre.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [accounts.yKeeper],
      });
      deployer = (owner as any).provider.getUncheckedSigner(accounts.yKeeper);
    }
    console.log('using address:', deployer._address);

    const crvStrategyKeep3rJob2 = await ethers.getContractAt('CrvStrategyKeep3rStealthJob2', contracts.crvStrategyKeep3rJob2.mainnet, deployer);

    const crvStrategies: any = [...v2CrvStrategies, ...v1CrvStrategies];
    const chainStrategies = await crvStrategyKeep3rJob2.callStatic.strategies();
    const strategyAddressess = v2CrvStrategies.map((strategy: any) => strategy.address);
    // Checks if there are strategies to remove
    for (const chainStrategyAddress of chainStrategies) {
      if (strategyAddressess.indexOf(chainStrategyAddress) != -1) continue;
      // else, chain strategy is not on local config. remove it!
      console.log('chain strategy:', chainStrategyAddress, 'is not on the local config file');
      console.log(`https://etherscan.io/address/${crvStrategyKeep3rJob2.address}#writeContract`);
      console.log(`removeStrategy(${chainStrategyAddress})`);
    }

    const strategiesToAdd = [];
    for (const configStrategyAddress of strategyAddressess) {
      if (chainStrategies.indexOf(configStrategyAddress) == -1) {
        console.log(configStrategyAddress, 'is on config but not on job');
        strategiesToAdd.push(configStrategyAddress);
      }
    }

    if (strategiesToAdd.length > 0) {
      // TODO add missing strats and exit
      if (!(await confirmAddStrategies.run())) return;
      for (const strategyToAdd of strategiesToAdd) {
      }
      return resolve();
    }

    // Checks if local data matches chain data
    for (const strategy of crvStrategies) {
      const requiredHarvest = await crvStrategyKeep3rJob2.requiredHarvest(strategy.address);
      const requiredEarn = await crvStrategyKeep3rJob2.requiredEarn(strategy.address);
      if (!strategy.requiredHarvestAmount.eq(requiredHarvest)) {
        console.log(strategy.name, strategy.address);
        console.log('chain harvest:', requiredHarvest.toString());
        console.log('local harvest:', strategy.requiredHarvestAmount.toString());
        strategy.update = true;
      }

      if (!bn.from(10).pow(strategy.requiredEarn.decimals).mul(strategy.requiredEarn.amount).eq(requiredEarn)) {
        console.log(strategy.name, strategy.address);
        console.log('chain earn:', requiredEarn.toString());
        console.log('local earn:', bn.from(10).pow(strategy.requiredEarn.decimals).mul(strategy.requiredEarn.amount).toString());
        strategy.update = true;
      }
    }

    const outdatedV1CrvStrategies = crvStrategies.filter((strategy: any) => strategy.update);
    console.log('updating', outdatedV1CrvStrategies.length, 'crvStrategies');
    console.log(outdatedV1CrvStrategies.map((strategy: any) => strategy.name).join(', '));

    if (!(await confirm.run())) return resolve();

    // Update crv strategies on crv keep3r
    console.time('updateStrategies');
    for (const strategy of outdatedV1CrvStrategies) {
      console.log(strategy.address);
      await crvStrategyKeep3rJob2.callStatic.updateStrategy(
        strategy.address,
        strategy.requiredHarvestAmount,
        bn.from(10).pow(strategy.requiredEarn.decimals).mul(strategy.requiredEarn.amount)
      );
      await crvStrategyKeep3rJob2.updateStrategy(
        strategy.address,
        strategy.requiredHarvestAmount,
        bn.from(10).pow(strategy.requiredEarn.decimals).mul(strategy.requiredEarn.amount)
      );
    }
    console.timeEnd('updateStrategies');

    resolve();
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
