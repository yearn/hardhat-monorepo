import { ethers } from 'hardhat';
import { ExtendedEnabledTrade, Solver, TradeSetup } from '../types';
import * as uniswapV2Library from '@libraries/dexes/uniswap-v2';
import { UNISWAP_V2_FACTORY, UNISWAP_V2_ROUTER } from '@deploy/mainnet-swappers/uniswap_v2';
import { IERC20Metadata__factory, TradeFactory } from '@typechained';

export default class Dexes implements Solver {
  async solve(trade: ExtendedEnabledTrade, tradeFactory: TradeFactory): Promise<TradeSetup> {
    const uniswapSwapper = await ethers.getContract('AsyncUniswapV2');
    const tokenIn = await IERC20Metadata__factory.connect(trade._tokenIn, tradeFactory.signer);
    const amount = await tokenIn.balanceOf(trade._strategy);
    const swapperResponse = await uniswapV2Library.getBestPathEncoded({
      tokenIn: trade._tokenIn,
      tokenOut: trade._tokenOut,
      amountIn: amount,
      uniswapV2Router: UNISWAP_V2_ROUTER,
      uniswapV2Factory: UNISWAP_V2_FACTORY,
      slippage: trade._slippage,
    });
    const executeTx = await tradeFactory.populateTransaction['execute((address,address,address,uint256,uint256),address,bytes)'](
      {
        _strategy: trade._strategy,
        _tokenIn: trade._tokenIn,
        _tokenOut: trade._tokenOut,
        _amount: amount,
        _minAmountOut: swapperResponse.minAmountOut!,
      },
      uniswapSwapper.address,
      swapperResponse.data
    );
    return {
      swapperName: 'UniswapV2',
      transaction: executeTx,
    };
  }
}
