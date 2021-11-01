import { ethers, getChainId } from 'hardhat';
import sleep from 'sleep-promise';
import uniswap from '@libraries/uniswap-v2';
import moment from 'moment';
import { BigNumber, utils } from 'ethers';
import { TradeFactory } from '@typechained';
import zrx from './libraries/zrx';
import { UNISWAP_V2_FACTORY, UNISWAP_V2_ROUTER, WETH } from '@deploy/mainnet-swappers/uniswap_v2';

const DELAY = moment.duration('3', 'minutes').as('milliseconds');
const FLASHBOT_PROVIDER = new ethers.providers.JsonRpcProvider('https://rpc.flashbots.net');
const SLIPPAGE_PERCENTAGE = 3;

type PendingTrade = [BigNumber, string, string, string, BigNumber, BigNumber] & {
  _id: BigNumber;
  _strategy: string;
  _tokenIn: string;
  _tokenOut: string;
  _amountIn: BigNumber;
  _deadline: BigNumber;
};

type TradeSetup = {
  swapper: string;
  data: string;
  minAmountOut: BigNumber | undefined;
};

async function main() {
  const chainId = await getChainId();
  console.log('Chain ID:', chainId);
  let [flashBotSigner] = await ethers.getSigners();
  flashBotSigner = flashBotSigner.connect(FLASHBOT_PROVIDER);

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

    const tx = await tradeFactory
      .connect(flashBotSigner)
      ['execute(uint256,address,uint256,bytes)'](pendingTrade._id, bestSetup.swapper, bestSetup.minAmountOut!, bestSetup.data, {
        gasLimit: 4_000_000,
      });
    console.log('Pending trade', pendingTrade._id, 'executed via', bestSetup.swapper, 'with tx', tx.hash);
    await sleep(DELAY);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
