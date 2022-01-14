import { ethers, network } from 'hardhat';
import { BigNumber, PopulatedTransaction, utils, Wallet } from 'ethers';
import { IERC20Metadata } from '@typechained';
import sleep from 'sleep-promise';
import moment from 'moment';
import { abi as IERC20_ABI } from '@openzeppelin/contracts/build/contracts/IERC20Metadata.json';
import * as gasprice from './libraries/gasprice';
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
import kms from '../../commons/tools/kms';
import { getNodeUrl } from '@utils/network';
import { JsonRpcProvider } from '@ethersproject/providers';
import * as evm from '@test-utils/evm';

const DELAY = moment.duration('8', 'minutes').as('milliseconds');
const RETRIES = 20;
const MAX_GAS_PRICE = utils.parseUnits('300', 'gwei');
const FLASHBOT_MAX_PRIORITY_FEE_PER_GAS = 4;

// Flashbot
let flashbotsProvider: FlashbotsBundleProvider;
type FlashbotBundle = Array<FlashbotsBundleTransaction | FlashbotsBundleRawTransaction>;

// Provider
let httpProvider: JsonRpcProvider;

// Multicall swappers
const multicalls = [new ThreePoolCrvMulticall()];

async function main() {
  await gasprice.start();

  console.log('[Setup] Forking mainnet');

  // We set this so hardhat-deploys uses the correct deployment addresses.
  process.env.HARDHAT_DEPLOY_FORK = 'mainnet';
  await evm.reset({
    jsonRpcUrl: getNodeUrl('mainnet'),
  });

  const protect = new ethers.providers.JsonRpcProvider('https://rpc.flashbots.net');

  const ymech = new ethers.Wallet(await kms.decrypt(process.env.MAINNET_1_PRIVATE_KEY as string), ethers.provider);
  await ethers.provider.send('hardhat_setBalance', [ymech.address, '0xffffffffffffffff']);
  console.log('[Setup] Executing with address', ymech.address);

  // We create a provider thats connected to a real network, hardhat provider will be connected to fork
  httpProvider = new ethers.providers.JsonRpcProvider(getNodeUrl('mainnet'), 'mainnet');

  // console.log('[Setup] Creating flashbots provider ...');
  // flashbotsProvider = await FlashbotsBundleProvider.create(
  //   httpProvider, // a normal ethers.js provider, to perform gas estimiations and nonce lookups
  //   ymech // ethers.js signer wallet, only for signing request payloads, not transactions
  // );

  const tradeFactory = await ethers.getContract('TradeFactory', ymech);
  const pendingTradesIds = await tradeFactory['pendingTradesIds()']();
  const pendingTrades: PendingTrade[] = [];

  for (const id of pendingTradesIds) {
    pendingTrades.push(await tradeFactory.pendingTradesById(id));
  }

  let nonce = await ethers.provider.getTransactionCount(ymech.address);

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

    const simulatedTx = await tradeFactory['execute(uint256,address,uint256,bytes)'](
      pendingTrade._id,
      bestSetup.swapper,
      bestSetup.minAmountOut!,
      bestSetup.data
    );
    const confirmedTx = await simulatedTx.wait();
    console.log('[Execution] Simulation in fork succeeded used', confirmedTx.gasUsed.toString(), 'gas');

    const executeTx = await tradeFactory.populateTransaction['execute(uint256,address,uint256,bytes)'](
      pendingTrade._id,
      bestSetup.swapper,
      bestSetup.minAmountOut!,
      bestSetup.data,
      {
        nonce,
      }
    );

    await generateAndSendBundle({
      pendingTrade,
      bestSetup,
      wallet: ymech,
      executeTx,
      gasParams,
    });

    await sleep(DELAY);
  }
}

async function generateAndSendBundle(params: {
  pendingTrade: PendingTrade;
  bestSetup: TradeSetup;
  wallet: Wallet;
  executeTx: PopulatedTransaction;
  gasParams: {
    maxFeePerGas: BigNumber;
    maxPriorityFeePerGas: BigNumber;
  };
  retryNumber?: number;
}): Promise<boolean> {
  const blockProtection = await ethers.getContractAt('BlockProtection', '0xCC268041259904bB6ae2c84F9Db2D976BCEB43E5', params.wallet);
  const targetBlockNumber = (await httpProvider.getBlockNumber()) + 2;

  const populatedTx = await blockProtection.populateTransaction.callWithBlockProtection(
    params.executeTx.to, // address _to,
    params.executeTx.data, // bytes memory _data,
    targetBlockNumber // uint256 _blockNumber
  );

  const signedTx = await params.wallet.signTransaction({
    ...params.gasParams,
    to: populatedTx.to!,
    gasLimit: populatedTx.gasLimit!.toNumber(),
    data: populatedTx.data!,
  });

  console.log('[Execution] Sending transaction in block', targetBlockNumber);
  // const protect = new ethers.providers.JsonRpcProvider('https://rpc.flashbots.net');
  // const protectTx = await protect.sendTransaction(signedTx);
  // console.log(`[Execution] Transaction submitted via protect rpc - https://protect.flashbots.net/tx/?hash=${protectTx.hash}`);

  const bundle: FlashbotBundle = [
    {
      signedTransaction: signedTx,
    },
  ];
  console.log('[Execution] Signed with hash:', signedTx);
  if (await submitBundleForBlock(bundle, targetBlockNumber)) {
    console.log('[Execution] Pending trade', params.pendingTrade._id, 'executed via', params.bestSetup.swapper);
    return true;
  }
  if (!params.retryNumber) params.retryNumber = 0;
  params.retryNumber++;
  if (params.retryNumber! >= RETRIES) {
    return false;
  } else {
    return await generateAndSendBundle(params);
  }
}

async function submitBundleForBlock(bundle: FlashbotBundle, targetBlockNumber: number): Promise<boolean> {
  let included = false;
  let rejected = false;
  while (!(included || rejected)) {
    if (!(await simulateBundle(bundle, targetBlockNumber))) {
      rejected = true;
      continue;
    }
    const flashbotsTransactionResponse: FlashbotsTransaction = await flashbotsProvider.sendBundle(bundle, targetBlockNumber);
    const resolution = await (flashbotsTransactionResponse as FlashbotsTransactionResponse).wait();
    if (resolution == FlashbotsBundleResolution.BundleIncluded) {
      console.log('[Flashbot] BundleIncluded, sucess!');
      included = true;
    } else if (resolution == FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
      console.log('[Flashbot] BlockPassedWithoutInclusion, re-build and re-send bundle');
    } else if (resolution == FlashbotsBundleResolution.AccountNonceTooHigh) {
      console.log('[Flashbot] AccountNonceTooHigh, adjust nonce');
      rejected = true;
    }
  }
  return included;
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
