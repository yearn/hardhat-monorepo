import { PendingTrade, TradeSetup } from './types';
import uniswap from '@libraries/uniswap-v2';
import { UNISWAP_V2_FACTORY, UNISWAP_V2_ROUTER, WETH } from '@deploy/mainnet-swappers/uniswap_v2';
import { abi as IERC20_ABI } from '@openzeppelin/contracts/build/contracts/IERC20Metadata.json';
import { IERC20Metadata } from '@typechained';
import { ethers, getChainId } from 'hardhat';
import zrx from './libraries/zrx';
import { utils } from 'ethers';

export class Router {
  async route(pendingTrade: PendingTrade): Promise<TradeSetup> {
    const chainId = await getChainId();
    const SLIPPAGE_PERCENTAGE = 3;
    const tradesSetup: TradeSetup[] = [];

    const tokenIn = await ethers.getContractAt<IERC20Metadata>(IERC20_ABI, pendingTrade._tokenIn);
    const tokenOut = await ethers.getContractAt<IERC20Metadata>(IERC20_ABI, pendingTrade._tokenOut);
    const decimalsOut = await tokenOut.decimals();
    const symbolOut = await tokenOut.symbol();

    // const { data: uniswapV2Data, minAmountOut: uniswapV2MinAmountOut } = await uniswap.getBestPathEncoded({
    //   tokenIn: pendingTrade._tokenIn,
    //   tokenOut: pendingTrade._tokenOut,
    //   amountIn: pendingTrade._amountIn,
    //   uniswapV2Router: UNISWAP_V2_ROUTER,
    //   uniswapV2Factory: UNISWAP_V2_FACTORY,
    //   hopTokensToTest: [WETH],
    //   slippage: SLIPPAGE_PERCENTAGE,
    // });

    // tradesSetup.push({
    //   swapper: (await ethers.getContract('AsyncUniswapV2')).address,
    //   swapperName: 'AsyncUniswapV2',
    //   data: uniswapV2Data,
    //   minAmountOut: uniswapV2MinAmountOut,
    // });

    // console.log('uniswap v2:', utils.formatUnits(uniswapV2MinAmountOut!, decimalsOut), uniswapV2Data);

    const { data: zrxData, minAmountOut: zrxMinAmountOut } = await zrx.quote({
      chainId: Number(chainId),
      sellToken: pendingTrade._tokenIn,
      buyToken: pendingTrade._tokenOut,
      sellAmount: pendingTrade._amountIn,
      slippagePercentage: SLIPPAGE_PERCENTAGE / 100,
    });

    tradesSetup.push({
      swapper: '0x75DfD3c064Ce21D253F66a277202FE455EaaDB01',
      swapperName: 'ZRX',
      data: zrxData,
      minAmountOut: zrxMinAmountOut,
    });

    console.log('zrx:', utils.formatUnits(zrxMinAmountOut!, decimalsOut), zrxData);

    let bestSetup: TradeSetup = tradesSetup[0];

    for (let i = 1; i < tradesSetup.length; i++) {
      if (tradesSetup[i].minAmountOut!.gt(bestSetup.minAmountOut!)) {
        bestSetup = tradesSetup[i];
      }
    }

    return bestSetup;
  }
}
