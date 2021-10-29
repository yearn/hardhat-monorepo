import { run, ethers } from 'hardhat';
import Safe, { EthersAdapter } from '@gnosis.pm/safe-core-sdk';
import { NETWORK_ID_NAMES } from '@utils/network';

const { Confirm } = require('enquirer');
const { Input } = require('enquirer');
const confirmPrompt = new Confirm({ message: 'Do you wish to sign a gnosis safe txHash?' });
const safeInputPrompt = new Input({
  message: 'Paste gnosis safe address',
  initial: '0x...',
});
const hashInputPrompt = new Input({
  message: 'Paste safeTxHash to sign',
  initial: '0x...',
});

async function main() {
  await run('compile');
  await confirmPrompt.run().then(async () => {
    await mainExecute();
  });
}

function mainExecute(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    const [offchainSigner] = await ethers.getSigners();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const networkName = NETWORK_ID_NAMES[chainId];
    if (!networkName) throw Error(`chainId: ${chainId} is not supported`);
    console.log('using address:', offchainSigner.address, 'on', networkName);
    console.log('using address:', offchainSigner.address, 'on', networkName);

    try {
      const safeAddress = await safeInputPrompt.run();
      if (safeAddress.length != 42) throw Error('invalid safeAddress length');
      const ethAdapterExecutor = new EthersAdapter({ ethers, signer: offchainSigner });
      const safeSdk: Safe = await Safe.create({ ethAdapter: ethAdapterExecutor, safeAddress });
      const safeTxHash = await hashInputPrompt.run();
      if (safeTxHash.length != 66) throw Error('invalid safeTxHash length');
      const signature = await safeSdk.signTransactionHash(safeTxHash);
      console.log({ signer: signature.signer, data: signature.data });
      resolve();
    } catch (err: any) {
      reject(`Error while signing gnosis safe txHash: ${err.message}`);
    }
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
