import { Contract, ContractFactory, utils, BigNumber, Signer } from 'ethers';
import { run, ethers, network } from 'hardhat';
import {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution,
  FlashbotsTransaction,
  FlashbotsTransactionResponse,
  SimulationResponse,
} from '@flashbots/ethers-provider-bundle';
import * as contracts from '../../utils/contracts';

const { Confirm } = require('enquirer');
const prompt = new Confirm({ message: 'Do you wish to stealth-mint though flashbots on goerli?' });

async function main() {
  await run('compile');
  await prompt.run().then(async (answer: any) => {
    await mainExecute();
  });
}

function mainExecute(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    const [owner] = await ethers.getSigners();
    console.log('using address:', owner.address);

    const network = await ethers.provider.getNetwork();
    if (network.chainId != 5) return reject('not on goerly network. please use --network goerli');
    const provider = ethers.provider;

    const stealthRelayer = await ethers.getContractAt('StealthRelayer', contracts.stealthRelayer.goerli);
    const stealthERC20 = await ethers.getContractAt('StealthERC20', contracts.stealthERC20.goerli);
    console.log('creating signer');
    const signer = new ethers.Wallet(('0x' + process.env.GOERLI_PRIVATE_KEY) as string).connect(provider);

    // `authSigner` is an Ethereum private key that does NOT store funds and is NOT your bot's primary key.
    // This is an identifying key for signing payloads to establish reputation and whitelisting
    // In production, this should be used across multiple bundles to build relationship. In this example, we generate a new wallet each time
    console.log('creating flashbotSigner');
    const flashbotSigner = new ethers.Wallet(('0x' + process.env.FLASHBOTS_PRIVATE_KEY) as string).connect(provider);

    // Flashbots provider requires passing in a standard provider
    console.log('creating flashbotsProvider');
    const flashbotsProvider = await FlashbotsBundleProvider.create(
      provider, // a normal ethers.js provider, to perform gas estimiations and nonce lookups
      flashbotSigner, // ethers.js signer wallet, only for signing request payloads, not transactions
      'https://relay-goerli.flashbots.net/',
      'goerli'
    );

    // build work tx
    const mintAmount = utils.parseEther('100');
    const mintTx = await stealthERC20.populateTransaction.stealthMint(owner.address, mintAmount);

    const stealthHash = ethers.utils.solidityKeccak256(['string'], ['random-secret-hash']);
    let blockNumber = await ethers.provider.getBlockNumber();

    // NOTE: get this dynamically though estimated gas used + average fast gas price (check simulation)
    const coinbasePayment = utils.parseEther('1').div(100);

    const pendingBlock = await ethers.provider.send('eth_getBlockByNumber', ['latest', false]);
    const blockGasLimit = BigNumber.from(pendingBlock.gasLimit);

    // build stealth tx
    let nonce = ethers.BigNumber.from(await signer.getTransactionCount());
    const executeAndPayTx = await stealthRelayer.populateTransaction.executeAndPay(
      stealthERC20.address, // address _job,
      mintTx.data, // bytes memory _callData,
      stealthHash, // bytes32 _stealthHash,
      blockNumber + 1, // uint256 _blockNumber
      coinbasePayment, // uint256 _payment
      {
        nonce,
        gasPrice: 0,
        gasLimit: blockGasLimit.sub(15_000),
        value: coinbasePayment,
      }
    );
    console.log('executeAndPayTx');
    console.log(executeAndPayTx);

    const signedTransaction = await signer.signTransaction(executeAndPayTx);
    console.log('signedTransaction');
    console.log(signedTransaction);

    // build bundle
    const bundle = [
      {
        signedTransaction,
      },
    ];
    const signedBundle = await flashbotsProvider.signBundle(bundle);
    let simulation: SimulationResponse;
    try {
      simulation = await flashbotsProvider.simulate(signedBundle, blockNumber + 1);
      if ('error' in simulation) {
        return reject(`Simulation Error: ${simulation.error.message}`);
      } else {
        console.log(`Simulation Success: ${JSON.stringify(simulation, null, 2)}`);
      }
    } catch (error: any) {
      if ('body' in error && 'message' in JSON.parse(error.body).error) {
        console.log('[Simulation Error] Message:', JSON.parse(error.body).error.message);
      } else {
        console.log(error);
      }
      return reject('simulation error');
    }
    console.log(simulation);

    // NOTE: here you can rebalance payment using (results[0].gasPrice * gasUsed) + a % as miner bonus

    // send bundle
    const flashbotsTransactionResponse: FlashbotsTransaction = await flashbotsProvider.sendBundle(bundle, blockNumber + 1);

    const resolution = await (flashbotsTransactionResponse as FlashbotsTransactionResponse).wait();

    if (resolution == FlashbotsBundleResolution.BundleIncluded) {
      console.log('BundleIncluded, sucess!');
      return resolve();
    }
    if (resolution == FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
      console.log('BlockPassedWithoutInclusion, re-build and re-send bundle...');
      return await mainExecute();
    }
    if (resolution == FlashbotsBundleResolution.AccountNonceTooHigh) {
      return reject('AccountNonceTooHigh, adjust nonce');
    }
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
