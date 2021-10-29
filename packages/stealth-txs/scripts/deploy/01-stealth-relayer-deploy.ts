import { Contract, ContractFactory } from 'ethers';
import { run, ethers, network } from 'hardhat';
import * as contracts from '../../utils/contracts';

const { Confirm } = require('enquirer');
const prompt = new Confirm({ message: 'Do you wish to deploy StealthRelayer contract?' });

async function main() {
  await run('compile');

  await promptAndSubmit();
}

function promptAndSubmit(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    const [owner] = await ethers.getSigners();
    console.log('using address:', owner.address);
    prompt.run().then(async (answer: any) => {
      if (answer) {
        try {
          const stealthRelayerFactory: ContractFactory = await ethers.getContractFactory('StealthRelayer');
          const stealthRelayer: Contract = await stealthRelayerFactory.deploy(contracts.stealthVault.mainnet);
          console.log('stealthRelayer address:', stealthRelayer.address);

          console.log('PLEASE add to utils/contracts.ts');
          console.log(`export const stealthRelayer = '${stealthRelayer.address}'`);
          resolve();
        } catch (err) {
          reject(`Error while deploying stealthRelayer contract: ${err.message}`);
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
