import { NETWORK_ID_NAMES } from '@utils/network';
import { ContractFactory } from 'ethers';
import { run, ethers } from 'hardhat';
import * as contracts from '../../utils/contracts';

const { Confirm } = require('enquirer');
const { Input } = require('enquirer');
const prompt = new Confirm({ message: 'Do you wish to stealthSafeGuard contracts?' });
const safeInputPrompt = new Input({
  message: 'Paste gnosis safe address',
  initial: '0x...',
});

async function main() {
  await run('compile');
  await promptAndSubmit();
}

function promptAndSubmit(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    const [owner] = await ethers.getSigners();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const networkName = NETWORK_ID_NAMES[chainId];
    if (!networkName) throw Error(`chainId: ${chainId} is not supported`);
    console.log('using address:', owner.address, 'on', networkName);
    prompt.run().then(async (answer: any) => {
      if (answer) {
        try {
          const safeAddress = await safeInputPrompt.run();
          if (safeAddress.length != 42) throw Error('invalid safeAddress length');
          const StealthSafeGuard: ContractFactory = await ethers.getContractFactory('StealthSafeGuard');

          console.log('StealthSafeGuard:', safeAddress, contracts.stealthRelayer[networkName]);
          const stealthSafeGuard = await StealthSafeGuard.deploy(safeAddress, contracts.stealthRelayer[networkName]);
          console.log('StealthSafeGuard address:', stealthSafeGuard.address);
          console.log(`PLEASE: change utils/contracts.ts stealthSafeGuard ${networkName} address to: ${stealthSafeGuard.address}`);
          console.log();

          resolve();
        } catch (err: any) {
          reject(`Error while deploying v2 keep3r job contracts: ${err.message}`);
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
