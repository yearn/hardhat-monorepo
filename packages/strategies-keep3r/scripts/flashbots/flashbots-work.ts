import { ContractFactory, Wallet } from 'ethers';
import { run, ethers, network } from 'hardhat';
import { e18, ZERO_ADDRESS } from '../../utils/web3-utils';
import config from '../../contracts.json';
const escrowContracts = config.contracts.mainnet.escrow;
const mechanicsContracts = config.contracts.mainnet.mechanics;
const genericV2Keep3rJobContracts = config.contracts.mainnet.genericV2Keep3rJob;

import { FlashbotsBundleProvider, FlashbotsBundleResolution } from '@flashbots/ethers-provider-bundle';

const { Confirm } = require('enquirer');
const prompt = new Confirm('Do you wish to broadcast flashbot-tx?');

async function main() {
  const [owner] = await ethers.getSigners();
  const provider = ethers.getDefaultProvider();
  const signer = new ethers.Wallet('0x' + config.accounts.mainnet.privateKey).connect(provider);
  let nonce = ethers.BigNumber.from(await signer.getTransactionCount());

  const flashbotsSigner = Wallet.createRandom();
  const flashbotsProvider = await FlashbotsBundleProvider.create(provider, flashbotsSigner);
  const blockNumber = await ethers.provider.getBlockNumber();
  // const minTimestamp = (await provider.getBlock(blockNumber)).timestamp
  // const maxTimestamp = minTimestamp + 120

  const StealthVault: ContractFactory = await ethers.getContractFactory('StealthVault');
  const stealthVault = await StealthVault.deploy();
  const StealthRelayer: ContractFactory = await ethers.getContractFactory('StealthRelayer');
  // const stealthRelayer = (await StealthRelayer.deploy(stealthVault.address)).connect(signer);
  const stealthRelayer = await ethers.getContractAt(
    'StealthRelayer',
    'config.contracts.mainnet.stealthRelayer' // FIX really outdated script
  );

  // Setup crv strategy keep3r
  const crvStrategyKeep3r = await ethers.getContractAt('CrvStrategyKeep3rJob', config.contracts.mainnet.jobs.crvStrategyKeep3rJob, signer);

  const harvestTx = await crvStrategyKeep3r.populateTransaction.forceWork(
    '0xC59601F0CC49baa266891b7fc63d2D5FE097A79D', // pool3
    {
      gasPrice: 0,
      nonce,
    }
  );

  const minerTip = e18.div(100); // 0.01 ETH
  const relayerTx = await stealthRelayer.populateTransaction.executeOnBlock(
    crvStrategyKeep3r.address,
    harvestTx.data,
    blockNumber + 2,
    minerTip,
    {
      gasPrice: 0,
      nonce,
      value: minerTip,
    }
  );
  console.log('relayerTx:');
  console.log(relayerTx);
  const signedMessage = await signer.signTransaction(relayerTx);

  const signedTransaction = signedMessage;
  const signedBundle = await flashbotsProvider.signBundle([
    // {
    //   signer: signer,
    //   transaction: relayerTx
    // },
    {
      signedTransaction,
    },
  ]);

  const simulation = await flashbotsProvider.simulate(signedBundle, blockNumber + 2);

  console.log('simulation');
  console.log(simulation);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
