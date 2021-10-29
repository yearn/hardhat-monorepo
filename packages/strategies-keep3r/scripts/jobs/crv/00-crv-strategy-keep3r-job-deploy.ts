import { ContractFactory } from 'ethers';
import { run, ethers } from 'hardhat';
import { e18, ZERO_ADDRESS } from '../../../utils/web3-utils';
import config from '../../../contracts.json';
const mainnetContracts = config.contracts.mainnet;
const mechanicsContracts = mainnetContracts.mechanics;

const { Confirm } = require('enquirer');
const prompt = new Confirm('Do you wish to deploy crv keep3r contract?');

async function main() {
  await run('compile');
  const CrvStrategyKeep3rJob: ContractFactory = await ethers.getContractFactory('CrvStrategyKeep3rJob');
  await promptAndSubmit(CrvStrategyKeep3rJob);
}

function promptAndSubmit(CrvStrategyKeep3rJob: ContractFactory): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    const [owner] = await ethers.getSigners();
    console.log('using address:', owner.address);
    prompt.run().then(async (answer: any) => {
      if (answer) {
        console.time('CrvStrategyKeep3rJob deployed');
        try {
          console.log(
            mechanicsContracts.registry,
            mainnetContracts.keep3r.address,
            ZERO_ADDRESS,
            e18.mul(50).toString(), // 50 KP3R required
            0,
            0,
            true,
            24 * 60 * 60, // 1 day maxHarvestPeriod,
            30 * 60 // 30 minutes harvestCooldown
          );
          const crvStrategyKeep3rJob = await CrvStrategyKeep3rJob.deploy(
            mechanicsContracts.registry,
            mainnetContracts.keep3r.address,
            ZERO_ADDRESS,
            e18.mul(50), // 50 KP3R required
            0,
            0,
            true,
            24 * 60 * 60, // 1 day maxHarvestPeriod,
            30 * 60 // 30 minutes harvestCooldown
          );
          console.timeEnd('CrvStrategyKeep3rJob deployed');
          console.log('CrvStrategyKeep3rJob address:', crvStrategyKeep3rJob.address);
          console.log(
            'PLEASE: change .config.json & example.config.json proxyJobs.crvStrategyKeep3rJob address to:',
            crvStrategyKeep3rJob.address
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
