const hre = require('hardhat');
const ethers = hre.ethers;
const { bn } = require('../../../utils/web3-utils');
const { v2CrvStrategies } = require('../../../utils/v2-crv-strategies');
const { v1CrvStrategies } = require('../../../utils/v1-crv-strategies');
const config = require('../../../.config.json');
import * as contracts from '../../../utils/contracts';

const { Confirm } = require('enquirer');
const confirm = new Confirm('Do you want to modify strategies on crv keep3r job?');

async function main() {
  await hre.run('compile');
  await run();
}

function run() {
  return new Promise<void>(async (resolve) => {
    // Setup deployer
    const [owner] = await ethers.getSigners();
    let deployer;
    if (owner.address == config.accounts.mainnet.deployer) {
      deployer = owner;
      deployer._address = owner.address;
    } else {
      await hre.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [config.accounts.mainnet.deployer],
      });
      deployer = owner.provider.getUncheckedSigner(config.accounts.mainnet.deployer);
    }
    console.log('using address:', deployer._address);

    const crvStrategyKeep3rJob2 = await ethers.getContractAt('CrvStrategyKeep3rStealthJob2', contracts.crvStrategyKeep3rJob2.mainnet, deployer);

    const crvStrategies = [...v2CrvStrategies, ...v1CrvStrategies];

    // Checks if local data matches chain data
    const addedStrategies = await crvStrategyKeep3rJob2.strategies();
    for (const strategy of crvStrategies) {
      const added = addedStrategies.indexOf(strategy.address) != -1;
      if (added && strategy.added) continue;
      if (!added && !strategy.added) continue;
      console.log(strategy.name, strategy.address);
      if (!added && strategy.added) throw new Error('strategy set as added but not on job');
      if (added && !strategy.added) throw new Error('strategy set as not-added but added on job');
    }

    const newV1CrvStrategies = crvStrategies.filter((strategy) => !strategy.added);
    console.log('adding', newV1CrvStrategies.length, 'new crvStrategies');
    console.log(newV1CrvStrategies.map((strategy) => strategy.name).join(', '));

    if (newV1CrvStrategies.length == 0) return;
    // Add crv strategies to crv keep3r
    if (!(await confirm.run())) return;

    console.time('addStrategies');
    await crvStrategyKeep3rJob2.addStrategies(
      newV1CrvStrategies.map((strategy) => strategy.address),
      newV1CrvStrategies.map((strategy) => strategy.requiredHarvestAmount),
      newV1CrvStrategies.map((strategy) => bn.from(10).pow(strategy.requiredEarn.decimals).mul(strategy.requiredEarn.amount))
    );
    console.timeEnd('addStrategies');

    resolve();
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
