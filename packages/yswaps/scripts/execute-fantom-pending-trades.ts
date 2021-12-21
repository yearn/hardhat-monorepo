import { ethers, getChainId } from 'hardhat';
import sleep from 'sleep-promise';
import uniswap from '@libraries/uniswap-v2';
import moment from 'moment';
import { SPOOKYSWAP_FACTORY, SPOOKYSWAP_ROUTER, WETH, WFTM } from '@deploy/fantom-swappers/spookyswap';
import { SPIRITSWAP_FACTORY, SPIRITSWAP_ROUTER } from '@deploy/fantom-swappers/spiritswap';
import { BigNumber, utils } from 'ethers';
import { TradeFactory } from '@typechained';
import zrx from './libraries/zrx';
import { PendingTrade, TradeSetup } from './types';

const DELAY = moment.duration('1', 'minutes').as('milliseconds');
const SPOOKY_TOKEN = '0x841fad6eae12c286d1fd18d1d525dffa75c7effe';
const SPIRIT_TOKEN = '0x5cc61a78f164885776aa610fb0fe1257df78e59b';
const SLIPPAGE_PERCENTAGE = 3;

async function main() {
  const chainId = await getChainId();
  console.log('Chain ID:', chainId);
  const tradeFactory = await ethers.getContract<TradeFactory>('TradeFactory');
  const pendingTradesIds = await tradeFactory['pendingTradesIds()']();
  const pendingTrades: PendingTrade[] = [];
  const tradesSetup: TradeSetup[] = [];

  console.log('Pending trades:', pendingTradesIds.length);

  for (const id of pendingTradesIds) {
    pendingTrades.push(await tradeFactory.pendingTradesById(id));
  }

  for (const pendingTrade of pendingTrades) {
    if (pendingTrade._deadline.lt(moment().unix())) {
      console.log(`Expiring trade ${pendingTrade._id.toString()}`);
      await tradeFactory.expire(pendingTrade._id);
      continue;
    }

    const { data: spookyData, minAmountOut: spookyMinAmountOut } = await uniswap.getBestPathEncoded({
      tokenIn: pendingTrade._tokenIn,
      tokenOut: pendingTrade._tokenOut,
      amountIn: pendingTrade._amountIn,
      uniswapV2Router: SPOOKYSWAP_ROUTER,
      uniswapV2Factory: SPOOKYSWAP_FACTORY,
      hopTokensToTest: [SPOOKY_TOKEN, WFTM, WETH],
      slippage: SLIPPAGE_PERCENTAGE,
    });

    tradesSetup.push({
      swapper: (await ethers.getContract('AsyncSpookyswap')).address,
      data: spookyData,
      minAmountOut: spookyMinAmountOut,
    });

    console.log('spooky:', spookyMinAmountOut, spookyData);

    const { data: spiritData, minAmountOut: spiritMinAmountOut } = await uniswap.getBestPathEncoded({
      tokenIn: pendingTrade._tokenIn,
      tokenOut: pendingTrade._tokenOut,
      amountIn: pendingTrade._amountIn,
      uniswapV2Router: SPIRITSWAP_ROUTER,
      uniswapV2Factory: SPIRITSWAP_FACTORY,
      hopTokensToTest: [SPIRIT_TOKEN, WFTM, WETH],
      slippage: SLIPPAGE_PERCENTAGE,
    });

    tradesSetup.push({
      swapper: (await ethers.getContract('AsyncSpiritswap')).address,
      data: spiritData,
      minAmountOut: spiritMinAmountOut,
    });

    console.log('spirit:', spiritMinAmountOut, spiritData);

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

    const tx = await tradeFactory['execute(uint256,address,uint256,bytes)'](
      pendingTrade._id,
      bestSetup.swapper,
      bestSetup.minAmountOut!,
      bestSetup.data,
      {
        gasLimit: 8_000_000,
      }
    );

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
