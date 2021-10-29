import { NETWORK_ID_NAMES } from '@utils/network';
import { ContractFactory } from 'ethers';
import { run, ethers } from 'hardhat';

const { Confirm } = require('enquirer');
const prompt = new Confirm({ message: 'Do you wish to multicall2 contract?' });

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
          const Multicall2: ContractFactory = await ethers.getContractFactory('Multicall2');

          const multicall2 = await Multicall2.deploy();
          console.log('Multicall2 address:', multicall2.address);
          console.log(`PLEASE: change utils/contracts.ts multicall2 ${networkName} address to: ${multicall2.address}`);
          console.log();

          resolve();
        } catch (err) {
          reject(`Error while deploying Multicall2 contract: ${(err as any).message}`);
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
