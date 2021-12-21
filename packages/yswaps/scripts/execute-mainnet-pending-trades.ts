import { ethers, getChainId } from 'hardhat';
import sleep from 'sleep-promise';
import moment from 'moment';
import { BigNumber, utils } from 'ethers';
import { TradeFactory } from '@typechained';
import * as gasprice from './libraries/gasprice';
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

const DELAY = moment.duration('3', 'minutes').as('milliseconds');
const MAX_GAS_PRICE = utils.parseUnits('350', 'gwei');
const MAX_PRIORITY_FEE_GAS_PRICE = 15;

// Flashbot
let web3ReporterSigner: Account;
let flashbotsProvider: FlashbotsBundleProvider;

type FlashbotBundle = Array<FlashbotsBundleTransaction | FlashbotsBundleRawTransaction>;

async function main() {
  const chainId = await getChainId();
  console.log('[Setup] Chain ID:', chainId);
  const [signer] = await ethers.getSigners();
  const multicalls = [new ThreePoolCrvMulticall()]
  console.log('[Setup] Creating flashbots provider ...');
  flashbotsProvider = await FlashbotsBundleProvider.create(
    ethers.provider, // a normal ethers.js provider, to perform gas estimiations and nonce lookups
    signer // ethers.js signer wallet, only for signing request payloads, not transactions
  );

  const tradeFactory = await ethers.getContract<TradeFactory>('TradeFactory');
  const pendingTradesIds = await tradeFactory['pendingTradesIds()']();
  const pendingTrades: PendingTrade[] = [];

  for (const id of pendingTradesIds) {
    pendingTrades.push(await tradeFactory.pendingTradesById(id));
  }

  pendingTrades.push({
    _id: BigNumber.from("100"),
    _strategy: "0x0",
    _tokenIn: "0x0",
    _tokenOut: "0x0",
    _amountIn: BigNumber.from("200"),
    _deadline: BigNumber.from("200")
  } as PendingTrade);

  for (const pendingTrade of pendingTrades) {
    if (pendingTrade._deadline.lt(moment().unix())) {
      console.log(`Expiring trade ${pendingTrade._id.toString()}`);
      await tradeFactory.expire(pendingTrade._id);
      continue;
    }

    let bestSetup: TradeSetup;

    // Check if we need to run over a multicall swapper
    const multicall = multicalls.find(mc => mc.match(pendingTrade));
    if (multicall) {
      bestSetup = await multicall.asyncSwap(pendingTrade);
    } else {
      bestSetup = await new Router().route(pendingTrade);
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
    const bundle: FlashbotBundle = [
      {
        signedTransaction: signedTx.rawTransaction!,
      },
    ];
    if (await submitBundle(bundle)) console.log('Pending trade', pendingTrade._id, 'executed via', bestSetup.swapper);
    await sleep(DELAY);
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
