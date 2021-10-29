import { ContractFactory } from 'ethers';
import { run, ethers } from 'hardhat';
import { e18, ZERO_ADDRESS } from '../../../utils/web3-utils';
import * as contracts from '../../../utils/contracts';
import config from '../../../contracts.json';
const mainnetContracts = config.contracts.mainnet;
const mechanicsContracts = mainnetContracts.mechanics;

const { Confirm } = require('enquirer');
const prompt = new Confirm({
  message: 'Do you wish to deploy crv keep3r contract?',
});

async function main() {
  await run('compile');
  const CrvStrategyKeep3rStealthJob2: ContractFactory = await ethers.getContractFactory('CrvStrategyKeep3rStealthJob2');
  await promptAndSubmit(CrvStrategyKeep3rStealthJob2);
}

function promptAndSubmit(CrvStrategyKeep3rStealthJob2: ContractFactory): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    const [owner] = await ethers.getSigners();
    console.log('using address:', owner.address);
    prompt.run().then(async (answer: any) => {
      if (answer) {
        console.time('CrvStrategyKeep3rStealthJob2 deployed');
        try {
          const v2Keeper = await ethers.getContractAt('V2Keeper', config.contracts.mainnet.proxyJobs.v2Keeper);

          console.log(
            mechanicsContracts.registry,
            contracts.stealthRelayer.mainnet,
            mainnetContracts.keep3r.address,
            ZERO_ADDRESS,
            e18.mul(50).toString(), // 50 KP3R required
            0,
            0,
            true,
            2 * 24 * 60 * 60, // 2 days maxHarvestPeriod,
            30 * 60, // 30 minutes harvestCooldown
            v2Keeper.address
          );
          const crvStrategyKeep3rStealthJob2 = await CrvStrategyKeep3rStealthJob2.deploy(
            mechanicsContracts.registry,
            contracts.stealthRelayer.mainnet,
            mainnetContracts.keep3r.address,
            ZERO_ADDRESS,
            e18.mul(50), // 50 KP3R required
            0,
            0,
            true,
            2 * 24 * 60 * 60, // 2 days maxHarvestPeriod,
            30 * 60, // 30 minutes harvestCooldown
            v2Keeper.address
          );
          console.timeEnd('CrvStrategyKeep3rStealthJob2 deployed');
          console.log('CrvStrategyKeep3rStealthJob2 address:', crvStrategyKeep3rStealthJob2.address);
          console.log(
            'PLEASE: change .config.json & example.config.json proxyJobs.crvStrategyKeep3rStealthJob2 address to:',
            crvStrategyKeep3rStealthJob2.address
          );
          resolve();
        } catch (err) {
          reject(`Error while deploying crv keep3r contract: ${err.message}`);
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
