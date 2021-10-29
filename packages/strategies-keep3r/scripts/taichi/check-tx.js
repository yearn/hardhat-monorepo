const { Confirm, NumberPrompt, Input, Toggle } = require('enquirer');
const hre = require('hardhat');
const ethers = hre.ethers;
const config = require('../../.config.json');
const { gwei, e18 } = require('../../utils/web3-utils');
const taichi = require('../../utils/taichi');

const txHashPrompt = new Input({
  message: 'paste your private tx hash?',
  initial: '0x...',
});
const customGasPrompt = new Toggle({
  message: 'Send custom gasPrice?',
  enabled: 'Yes',
  disabled: 'No',
});
const gasPricePrompt = new NumberPrompt({
  name: 'number',
  message: 'type a custom gasPrice in gwei',
});
const customNoncePrompt = new Toggle({
  message: 'Send custom nonce?',
  enabled: 'Yes',
  disabled: 'No',
});
const sendTxPrompt = new Confirm({ message: 'Send tx?' });

async function main() {
  await hre.run('compile');
  await run();
}

function run() {
  return new Promise(async (resolve, reject) => {
    try {
      const txHash = await txHashPrompt.run();
      if (!txHash) reject('no txHash');
      console.log('searching txHash:', txHash);

      const status = await taichi.queryPrivateTransaction(txHash);
      console.log(status);

      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
