import { ethers, deployments, network } from 'hardhat';
import sleep from 'sleep-promise';
import moment from 'moment';
import { BigNumber, Signer, utils } from 'ethers';
import { IERC20Metadata, TradeFactory, TradeFactory__factory } from '@typechained';
import { abi as IERC20_ABI } from '@openzeppelin/contracts/build/contracts/IERC20Metadata.json';
import * as gasprice from './libraries/gasprice';
import Web3 from 'web3';
import { Account } from 'web3-core';
import {
  FlashbotsBundleProvider,
  FlashbotsBundleRawTransaction,
  FlashbotsBundleResolution,
  FlashbotsBundleTransaction,
  FlashbotsTransaction,
  FlashbotsTransactionResponse,
} from '@flashbots/ethers-provider-bundle';
import { PendingTrade, TradeSetup } from './types';
import { ThreePoolCrvMulticall } from './multicall/ThreePoolCrvMulticall';
import { Router } from './Router';
import { impersonate } from './utils';
import kms from '../../commons/tools/kms';
import { getNodeUrl } from '@utils/network';
import { JsonRpcProvider } from '@ethersproject/providers';
import * as evm from '@test-utils/evm';

const DELAY = moment.duration('3', 'minutes').as('milliseconds');
const MAX_GAS_PRICE = utils.parseUnits('350', 'gwei');
const FLASHBOT_MAX_PRIORITY_FEE_PER_GAS = 2.5;
const MAX_PRIORITY_FEE_PER_GAS = utils.parseUnits('6', 'gwei');

// Flashbot
let flashbotsProvider: FlashbotsBundleProvider;
type FlashbotBundle = Array<FlashbotsBundleTransaction | FlashbotsBundleRawTransaction>;

// Provider
let httpProvider: JsonRpcProvider;

// Multicall swappers
const multicalls = [new ThreePoolCrvMulticall()];

async function main() {
  console.log('[Setup] Forking mainnet');

  // We set this so hardhat-deploys uses the correct deployment addresses.
  process.env.HARDHAT_DEPLOY_FORK = 'mainnet';
  await evm.reset({
    jsonRpcUrl: getNodeUrl('mainnet'),
  });

  const protect = new ethers.providers.JsonRpcProvider('https://rpc.flashbots.net');

  const web3ReporterSigner = new Web3().eth.accounts.privateKeyToAccount(await kms.decrypt(process.env.MAINNET_1_PRIVATE_KEY as string));

  // We create a provider thats connected to a real network, hardhat provider will be connected to fork
  httpProvider = new ethers.providers.JsonRpcProvider(getNodeUrl('mainnet'), 'mainnet');

  // console.log('[Setup] Creating flashbots provider ...');
  // flashbotsProvider = await FlashbotsBundleProvider.create(
  //   httpProvider, // a normal ethers.js provider, to perform gas estimiations and nonce lookups
  //   signer // ethers.js signer wallet, only for signing request payloads, not transactions
  // );

  const ymech = await impersonate(web3ReporterSigner.address);
  console.log('[Setup] Executing with address', web3ReporterSigner.address);

  const tradeFactory: TradeFactory = await ethers.getContract('TradeFactory', ymech);
  const pendingTradesIds = await tradeFactory['pendingTradesIds()']();
  const pendingTrades: PendingTrade[] = [];

  for (const id of pendingTradesIds) {
    pendingTrades.push(await tradeFactory.pendingTradesById(id));
  }

  for (const pendingTrade of pendingTrades) {
    const tokenIn = await ethers.getContractAt<IERC20Metadata>(IERC20_ABI, pendingTrade._tokenIn);
    const decimalsIn = await tokenIn.decimals();
    const symbolIn = await tokenIn.symbol();

    console.log(
      '[Execution] Executing trade with id',
      pendingTrade._id.toNumber(),
      'of',
      utils.formatUnits(pendingTrade._amountIn, decimalsIn),
      symbolIn
    );

    let bestSetup: TradeSetup;

    // Check if we need to run over a multicall swapper
    const multicall = multicalls.find((mc) => mc.match(pendingTrade));
    if (multicall) {
      console.log('[Multicall] Taking snapshot of fork');

      const snapshotId = (await network.provider.request({
        method: 'evm_snapshot',
        params: [],
      })) as string;

      console.log('[Multicall] Getting data');

      bestSetup = await multicall.asyncSwap(pendingTrade);

      console.log('[Multicall] Reverting to snapshot');
      await network.provider.request({
        method: 'evm_revert',
        params: [snapshotId],
      });
    } else {
      bestSetup = await new Router().route(pendingTrade);
    }

    const currentGas = gasprice.get(gasprice.Confidence.Highest);
    const gasParams = {
      maxFeePerGas: MAX_GAS_PRICE,
      maxPriorityFeePerGas:
        currentGas.maxPriorityFeePerGas > FLASHBOT_MAX_PRIORITY_FEE_PER_GAS
          ? utils.parseUnits(`${currentGas.maxPriorityFeePerGas}`, 'gwei')
          : utils.parseUnits(`${FLASHBOT_MAX_PRIORITY_FEE_PER_GAS}`, 'gwei'),
    };

    // Execute in our fork
    console.log('[Execution] Executing trade in fork');
    await tradeFactory['execute(uint256,address,uint256,bytes)'](pendingTrade._id, bestSetup.swapper, bestSetup.minAmountOut!, bestSetup.data);
    console.log('[Execution] Simulation in fork succeeded !');

    const populatedTx = await tradeFactory.populateTransaction['execute(uint256,address,uint256,bytes)'](
      pendingTrade._id,
      bestSetup.swapper,
      bestSetup.minAmountOut!,
      bestSetup.data,
      {
        ...gasParams,
        gasLimit: BigNumber.from('2000000'), // TODO why are we hardcoding gas here? (either use estimateGas of leave empty)
      }
    );

    const signedTx = await web3ReporterSigner.signTransaction({
      ...gasParams,
      to: populatedTx.to!,
      gas: populatedTx.gasLimit!.toNumber(),
      data: populatedTx.data!,
    });

    console.log('[Execution] Sending transaction in block', await httpProvider.getBlockNumber());
    const protectTx = await protect.sendTransaction(signedTx.rawTransaction!);
    console.log(`[Execution] Transaction submitted via protect rpc - https://protect.flashbots.net/tx/?hash=${protectTx.hash}`);

    // const bundle: FlashbotBundle = [
    //   {
    //     signedTransaction: signedTx.rawTransaction!,
    //   },
    // ];
    // console.log('[Execution] Signed with hash:', signedTx.transactionHash!);
    // if (await submitBundle(bundle)) console.log('[Execution] Pending trade', pendingTrade._id, 'executed via', bestSetup.swapper);

    await sleep(DELAY);
  }
}

async function submitBundle(bundle: FlashbotBundle): Promise<boolean> {
  let submitted = false;
  let rejected = false;
  const blockNumber = await httpProvider.getBlockNumber();
  let targetBlock = blockNumber + 1;
  while (!(submitted || rejected)) {
    if (!(await simulateBundle(bundle, targetBlock))) {
      rejected = true;
      continue;
    }
    const flashbotsTransactionResponse: FlashbotsTransaction = await flashbotsProvider.sendBundle(bundle, targetBlock);
    flashbotsProvider.sendBundle(bundle, targetBlock + 1);
    flashbotsProvider.sendBundle(bundle, targetBlock + 2);
    const resolution = await (flashbotsTransactionResponse as FlashbotsTransactionResponse).wait();
    if (resolution == FlashbotsBundleResolution.BundleIncluded) {
      console.log('[Flashbot] BundleIncluded, sucess!');
      submitted = true;
    } else if (resolution == FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
      console.log('[Flashbot] BlockPassedWithoutInclusion, re-build and re-send bundle');
    } else if (resolution == FlashbotsBundleResolution.AccountNonceTooHigh) {
      console.log('[Flashbot] AccountNonceTooHigh, adjust nonce');
      rejected = true;
    }
    targetBlock += 1;
  }
  return submitted;
}

async function simulateBundle(bundle: FlashbotBundle, blockNumber: number): Promise<boolean> {
  const signedBundle = await flashbotsProvider.signBundle(bundle);
  try {
    const simulation = await flashbotsProvider.simulate(signedBundle, blockNumber);
    if ('error' in simulation) {
      console.error(`[Flashbot] Simulation error: ${simulation.error.message}`);
    } else {
      console.log('[Flashbot] Simulation success !');
      return true;
    }
  } catch (error: any) {
    console.error('[Flashbot] Simulation error:', error.message);
  }
  return false;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
