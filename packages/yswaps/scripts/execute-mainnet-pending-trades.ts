import { ethers, getChainId } from 'hardhat';
import sleep from 'sleep-promise';
import uniswap from '@libraries/uniswap-v2';
import moment from 'moment';
import { BigNumber, utils } from 'ethers';
import { TradeFactory } from '@typechained';
import zrx from './libraries/zrx';
import * as gasprice from './libraries/gasprice';
import { Account } from 'web3-core';
import { UNISWAP_V2_FACTORY, UNISWAP_V2_ROUTER, WETH } from '@deploy/mainnet-swappers/uniswap_v2';
import {
  FlashbotsBundleProvider,
  FlashbotsBundleRawTransaction,
  FlashbotsBundleResolution,
  FlashbotsBundleTransaction,
  FlashbotsTransaction,
  FlashbotsTransactionResponse,
} from '@flashbots/ethers-provider-bundle';

import {PendingTrade, TradeSetup} from './types';
import { ThreePoolCrvHook } from './hooks/ThreePoolCrvHook';

const DELAY = moment.duration('3', 'minutes').as('milliseconds');
const SLIPPAGE_PERCENTAGE = 3;
const MAX_GAS_PRICE = utils.parseUnits('350', 'gwei');
const MAX_PRIORITY_FEE_GAS_PRICE = 15;

// Flashbot
let web3ReporterSigner: Account;
let flashbotsProvider: FlashbotsBundleProvider;

type FlashbotBundle = Array<FlashbotsBundleTransaction | FlashbotsBundleRawTransaction>;



async function main() {
  const hooks = [new ThreePoolCrvHook()]
  const chainId = await getChainId();
  // create fork as singleton
  console.log('[Setup] Chain ID:', chainId);
  const [signer] = await ethers.getSigners();
  console.log('[Setup] Creating flashbots provider ...');
  flashbotsProvider = await FlashbotsBundleProvider.create(
    ethers.provider, // a normal ethers.js provider, to perform gas estimations and nonce lookups
    signer // ethers.js signer wallet, only for signing request payloads, not transactions
  );

  const tradeFactory = await ethers.getContract<TradeFactory>('TradeFactory');
  const pendingTradesIds = await tradeFactory['pendingTradesIds()']();
  const pendingTrades: PendingTrade[] = [];
  const tradesSetup: TradeSetup[] = [];

  for (const id of pendingTradesIds) {
    pendingTrades.push(await tradeFactory.pendingTradesById(id));
  }

  for (const pendingTrade of pendingTrades) {
    if (pendingTrade._deadline.lt(moment().unix())) {
      console.log(`Expiring trade ${pendingTrade._id.toString()}`);
      await tradeFactory.expire(pendingTrade._id);
      continue;
    }

    const hook = hooks.find(hook => hook.match(pendingTrade));
    hook?.preSwap(pendingTrade);

    const { data: uniswapV2Data, minAmountOut: uniswapV2MinAmountOut } = await uniswap.getBestPathEncoded({
      tokenIn: pendingTrade._tokenIn,
      tokenOut: pendingTrade._tokenOut,
      amountIn: pendingTrade._amountIn,
      uniswapV2Router: UNISWAP_V2_ROUTER,
      uniswapV2Factory: UNISWAP_V2_FACTORY,
      hopTokensToTest: [WETH],
      slippage: SLIPPAGE_PERCENTAGE,
    });

    tradesSetup.push({
      swapper: (await ethers.getContract('AsyncUniswapV2')).address,
      data: uniswapV2Data,
      minAmountOut: uniswapV2MinAmountOut,
    });

    console.log('uniswap v2:', uniswapV2MinAmountOut, uniswapV2Data);

    const { data: zrxData, minAmountOut: zrxMinAmountOut } = await zrx.quote({
      chainId: Number(chainId),
      sellToken: pendingTrade._tokenIn,
      buyToken: pendingTrade._tokenOut,
      sellAmount: pendingTrade._amountIn,
      slippagePercentage: SLIPPAGE_PERCENTAGE / 100,
    });

    tradesSetup.push({
      swapper: (await ethers.getContract('ZRX')).address,
      data: zrxData,
      minAmountOut: zrxMinAmountOut,
    });

    console.log('zrx:', zrxMinAmountOut, zrxData);

    let bestSetup: TradeSetup = tradesSetup[0];

    for (let i = 1; i < tradesSetup.length; i++) {
      if (tradesSetup[i].minAmountOut!.gt(bestSetup.minAmountOut!)) {
        bestSetup = tradesSetup[i];
      }
    }

    const currentGas = gasprice.get(gasprice.Confidence.Highest);
    const gasParams = {
      maxFeePerGas: MAX_GAS_PRICE,
      maxPriorityFeePerGas:
        currentGas.maxPriorityFeePerGas > MAX_PRIORITY_FEE_GAS_PRICE
          ? utils.parseUnits(`${MAX_PRIORITY_FEE_GAS_PRICE}`, 'gwei')
          : utils.parseUnits(`${currentGas.maxPriorityFeePerGas}`, 'gwei'),
    };

    const populatedTx = await tradeFactory.populateTransaction['execute(uint256,address,uint256,bytes)'](
      pendingTrade._id,
      bestSetup.swapper,
      bestSetup.minAmountOut!,
      bestSetup.data,
      {
        ...gasParams,
        gasLimit: BigNumber.from('100000'),
      }
    );
    const signedTx = await web3ReporterSigner.signTransaction({
      ...gasParams,
      to: populatedTx.to!,
      gas: populatedTx.gasLimit!.toNumber(),
      data: populatedTx.data!,
    });

    // TODO sign preSwapTxs & postSwapTxs populated txs

    /*
      - EOA
      - transaction array [populated txs]
      - ds-proxy [multisend] onlyExecutor(EOA)
      - ds-proxy.execute([populated txs]) (to[], data[], value[]?, blockNumber?)
        - set block protection
        - sign as EOA and send to flashbots

    
    */

    const bundle: FlashbotBundle = [
      // ...preSwapTxs,
      {
        signedTransaction: signedTx.rawTransaction!,
      },
      // ...postSwapTxs,
    ];
    if (await submitBundle(bundle)) console.log('Pending trade', pendingTrade._id, 'executed via', bestSetup.swapper);
    await sleep(DELAY);


    hook?.postSwap(pendingTrade);
  }
}

async function submitBundle(bundle: FlashbotBundle): Promise<boolean> {
  let submitted = false;
  let rejected = false;
  const blockNumber = await ethers.provider.getBlockNumber();
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
