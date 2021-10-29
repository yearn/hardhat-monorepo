import { run, ethers, network } from 'hardhat';
import { e18, gwei, ZERO_ADDRESS } from '../../../utils/web3-utils';
import * as contracts from '../../../utils/contracts';
import * as accounts from '../../../utils/accounts';
import * as taichi from '../../../utils/taichi';

import { v2StealthStrategies } from '../../../utils/v2-stealth-harvest-strategies';
import { Contract, ContractFactory, PopulatedTransaction } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution,
  FlashbotsTransaction,
  FlashbotsTransactionResponse,
  SimulationResponse,
} from '@flashbots/ethers-provider-bundle';
import { resolve } from 'dns';

const { Confirm } = require('enquirer');
// const prompt = new Confirm({
//   message: 'Do you wish to force work v2 stealth strategies?',
// });
let blockProtection: Contract;

async function main() {
  await run('compile');
  await promptAndSubmit();
}

function promptAndSubmit(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    const [owner] = await ethers.getSigners();
    let signer = owner;
    if (owner.address != accounts.yKeeperWorker) {
      console.log('on fork mode, impersonating yKeeperWorker');
      await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [accounts.yKeeperWorker],
      });
      const yKeeperWorker: any = ethers.provider.getUncheckedSigner(accounts.yKeeperWorker) as any as SignerWithAddress;
      yKeeperWorker.address = yKeeperWorker._address;
      signer = yKeeperWorker;
    }

    console.log('using address:', signer.address);
    // prompt.run().then(async (answer: any) => {
    //   if (answer) {
    try {
      // const mechanicsRegistry = await ethers.getContractAt(
      //   'MechanicsRegistry',
      //   contracts.mechanicsRegistry.mainnet,
      //   signer
      // );

      // const BlockProtection: ContractFactory = await ethers.getContractFactory(
      //   'BlockProtection'
      // );

      // blockProtection = await BlockProtection.deploy(mechanicsRegistry.address);

      // await mechanicsRegistry.addMechanic(blockProtection.address);

      blockProtection = await ethers.getContractAt('BlockProtection', contracts.blockProtection.mainnet, signer);

      const harvestV2Keep3rStealthJob = await ethers.getContractAt(
        'HarvestV2Keep3rStealthJob',
        contracts.harvestV2Keep3rStealthJob.mainnet,
        signer
      );

      const strategies = await harvestV2Keep3rStealthJob.callStatic.strategies();
      // const strategies = ['0xeC088B98e71Ba5FFAf520c2f6A6F0153f1bf494B'];

      console.log('strategies:', strategies);
      for (const strategy of strategies) {
        try {
          const workableStrategy = await harvestV2Keep3rStealthJob.callStatic.workable(strategy);
          console.log(strategy, 'workable:', workableStrategy);

          if (!workableStrategy) continue;
          const workTx = await harvestV2Keep3rStealthJob.populateTransaction.forceWorkUnsafe(strategy);

          // const blockNumber = await ethers.provider.getBlockNumber();
          // await blockProtection.connect(signer).callWithBlockProtection(workTx.to, workTx.data, blockNumber + 1);

          const error = await flashBotsSendTx(workTx);

          if (error) {
            console.log('error:');
            console.log(error);
            return;
          }

          console.log('done!');
          return resolve();
        } catch (error) {
          console.log(error);
        }
      }

      resolve();
    } catch (err) {
      reject(`Error while force work v2 stealth strategies: ${err.message}`);
    }
    // } else {
    //   console.error('Aborted!');
    //   resolve();
    // }
    // });
  });
}

async function flashBotsSendTx(workTx: PopulatedTransaction): Promise<any> {
  const network = await ethers.provider.getNetwork();
  if (network.chainId != 1) return 'not on mainnet network. please use --network mainnet';
  const provider = ethers.provider;

  console.log('creating signer');
  const signer = new ethers.Wallet(process.env.MAINNET_PRIVATE_KEY as string).connect(provider);

  // `authSigner` is an Ethereum private key that does NOT store funds and is NOT your bot's primary key.
  // This is an identifying key for signing payloads to establish reputation and whitelisting
  // In production, this should be used across multiple bundles to build relationship. In this example, we generate a new wallet each time
  console.log('creating flashbotSigner');
  const flashbotSigner = new ethers.Wallet(process.env.FLASHBOTS_PRIVATE_KEY as string).connect(provider);

  // Flashbots provider requires passing in a standard provider
  console.log('creating flashbotsProvider');
  const flashbotsProvider = await FlashbotsBundleProvider.create(
    provider, // a normal ethers.js provider, to perform gas estimiations and nonce lookups
    flashbotSigner // ethers.js signer wallet, only for signing request payloads, not transactions
  );

  const blockNumber = await ethers.provider.getBlockNumber();
  const targetBlockNumber = blockNumber + 2;

  const gasResponse = await taichi.getGasPrice();
  console.log('taichi gasPrices:', {
    fast: Math.floor(gasResponse.data.fast / 10 ** 9),
    standard: Math.floor(gasResponse.data.standard / 10 ** 9),
    slow: Math.floor(gasResponse.data.slow / 10 ** 9),
  });
  const gasPrice = ethers.BigNumber.from(gasResponse.data.fast);
  console.log('gasPrice in gwei:', gasPrice.div(gwei).toNumber());

  const maxGwei = 150;
  if (gasPrice.gt(gwei.mul(maxGwei))) {
    return `gas price > ${maxGwei}gwei`;
  }
  const fairGasPrice = gasPrice.mul(100 + 5).div(100);
  console.log('fairGasPrice in gwei:', fairGasPrice.div(gwei).toNumber());

  // build stealth tx
  let nonce = ethers.BigNumber.from(await signer.getTransactionCount());

  const executeTx = await blockProtection.populateTransaction.callWithBlockProtection(
    workTx.to, // address _to,
    workTx.data, // bytes memory _data,
    targetBlockNumber, // uint256 _blockNumber
    {
      nonce,
      gasPrice: fairGasPrice,
      gasLimit: 5_000_000,
    }
  );

  const signedTransaction = await signer.signTransaction(executeTx);

  // build bundle
  const bundle = [
    {
      signedTransaction,
    },
  ];
  const signedBundle = await flashbotsProvider.signBundle(bundle);
  let simulation: SimulationResponse;
  try {
    simulation = await flashbotsProvider.simulate(signedBundle, targetBlockNumber);
  } catch (error) {
    if ('body' in error && 'message' in JSON.parse(error.body).error) {
      console.log('[Simulation Error] Message:', JSON.parse(error.body).error.message);
    } else {
      console.log(error);
    }
    return 'simulation error';
  }
  if ('error' in simulation) {
    return `Simulation Error: ${simulation.error.message}`;
  } else {
    console.log(`Simulation Success: ${JSON.stringify(simulation, null, 2)}`);
  }

  // NOTE: here you can rebalance payment using (results[0].gasPrice * gasUsed) + a % as miner bonus
  // const fairPayment = gasPrice
  //   .mul(100 + 10) // + 10%
  //   .div(100)
  //   .mul(simulation.totalGasUsed);

  const executeTxRepriced = await blockProtection.populateTransaction.callWithBlockProtection(
    workTx.to, // address _to,
    workTx.data, // bytes memory _data,
    targetBlockNumber, // uint256 _blockNumber
    {
      nonce,
      gasPrice: fairGasPrice,
      gasLimit: 5_000_000,
    }
  );

  simulation = await flashbotsProvider.simulate(
    await flashbotsProvider.signBundle([
      {
        signedTransaction: await signer.signTransaction(executeTxRepriced),
      },
    ]),
    targetBlockNumber
  );
  console.log(`Simulation Success: ${JSON.stringify(simulation, null, 2)}`);

  // send bundle
  const flashbotsTransactionResponse: FlashbotsTransaction = await flashbotsProvider.sendBundle(
    [
      {
        signedTransaction: await signer.signTransaction(executeTxRepriced),
      },
    ],
    targetBlockNumber
  );

  const resolution = await (flashbotsTransactionResponse as FlashbotsTransactionResponse).wait();

  if (resolution == FlashbotsBundleResolution.BundleIncluded) {
    console.log('BundleIncluded, sucess!');
    return;
  }
  if (resolution == FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
    console.log('BlockPassedWithoutInclusion, re-build and re-send bundle...');
    return await flashBotsSendTx(workTx);
  }
  if (resolution == FlashbotsBundleResolution.AccountNonceTooHigh) {
    return 'AccountNonceTooHigh, adjust nonce';
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
