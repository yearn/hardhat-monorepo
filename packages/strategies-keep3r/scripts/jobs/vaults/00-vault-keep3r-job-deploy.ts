import { ContractFactory } from 'ethers';
import { run, ethers } from 'hardhat';
import { gwei, ZERO_ADDRESS } from '../../../utils/web3-utils';
import config from '../../../contracts.json';
const mainnetContracts = config.contracts.mainnet;
const mechanicsContracts = mainnetContracts.mechanics;

const { Confirm } = require('enquirer');
const prompt = new Confirm('Do you wish to deploy crv keep3r contract?');

async function main() {
  await run('compile');
  const VaultKeep3rJob: ContractFactory = await ethers.getContractFactory('VaultKeep3rJob');
  await promptAndSubmit(VaultKeep3rJob);
}

function promptAndSubmit(VaultKeep3rJob: ContractFactory): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    const [owner] = await ethers.getSigners();
    console.log('using address:', owner.address);
    prompt.run().then(async (answer: any) => {
      if (answer) {
        console.time('VaultKeep3rJob deployed');
        try {
          console.log(
            mechanicsContracts.registry,
            mainnetContracts.keep3r.address,
            ZERO_ADDRESS,
            0, // 0 KP3R required
            0,
            0,
            true,
            6 * 60 * 60, // 6 hours earnCooldown
            gwei.mul(185).toString() // 185 gwei maxGasPrice
          );
          const vaultKeep3rJob = await VaultKeep3rJob.deploy(
            mechanicsContracts.registry,
            mainnetContracts.keep3r.address,
            ZERO_ADDRESS,
            0, // 0 KP3R required
            0,
            0,
            true,
            6 * 60 * 60, // 6 hours earnCooldown
            gwei.mul(185) // 185 gwei maxGasPrice
          );
          console.timeEnd('VaultKeep3rJob deployed');
          console.log('VaultKeep3rJob address:', vaultKeep3rJob.address);
          console.log('PLEASE: change .config.json & example.config.json proxyJobs.vaultKeep3rJob address to:', vaultKeep3rJob.address);
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
