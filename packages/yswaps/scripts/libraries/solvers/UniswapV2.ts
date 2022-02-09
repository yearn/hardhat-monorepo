import { ethers } from 'hardhat';
import { ExtendedEnabledTrade, Solver, TradeSetup } from '../types';
import * as uniswapV2Library from '@libraries/dexes/uniswap-v2';
import { BigNumber } from 'ethers';
import { UNISWAP_V2_FACTORY, UNISWAP_V2_ROUTER } from '@deploy/mainnet-swappers/uniswap_v2';

export default class UniswapV2 implements Solver {
  constructor() {}
  async solve(trade: ExtendedEnabledTrade): Promise<TradeSetup> {
    const uniswapSwapper = await ethers.getContract('AsyncUniswapV2');
    const swapperResponse = await uniswapV2Library.getBestPathEncoded({
      tokenIn: trade._tokenIn,
      tokenOut: trade._tokenOut,
      amountIn: trade._amount as BigNumber,
      uniswapV2Router: UNISWAP_V2_ROUTER,
      uniswapV2Factory: UNISWAP_V2_FACTORY,
      slippage: trade._slippage,
    });
    return {
      swapper: uniswapSwapper.address,
      swapperName: 'UniswapV2',
      data: swapperResponse.data,
      minAmountOut: swapperResponse.minAmountOut!,
    };
  }
}
