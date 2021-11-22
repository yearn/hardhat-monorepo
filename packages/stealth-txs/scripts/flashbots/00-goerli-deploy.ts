import { StealthRelayer, StealthRelayer__factory, StealthVault, StealthVault__factory } from '@typechained';
import { run, ethers } from 'hardhat';

const { Confirm } = require('enquirer');
const prompt = new Confirm({ message: 'Do you wish to deploy Stealth contracts on goerli?' });

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
          const stealthVaultFactory: StealthVault__factory = await ethers.getContractFactory<StealthVault__factory>('StealthVault');
          const stealthVault: StealthVault = await stealthVaultFactory.deploy();
          console.log('stealthVault address:', stealthVault.address);

          console.log('PLEASE add to utils/contracts.ts');
          console.log(`export const stealthVault = goerli: '${stealthVault.address}'`);

          const stealthRelayerFactory: StealthRelayer__factory = await ethers.getContractFactory<StealthRelayer__factory>('StealthRelayer');
          const stealthRelayer: StealthRelayer = await stealthRelayerFactory.deploy(stealthVault.address, { gasLimit: 2000000 });
          console.log('stealthRelayer address:', stealthRelayer.address);

          console.log('PLEASE add to utils/contracts.ts');
          console.log(`export const stealthRelayer = goerli: '${stealthRelayer.address}'`);
          resolve();
        } catch (err: any) {
          reject(`Error while deploying stealth contracts to goerli: ${err.message}`);
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
