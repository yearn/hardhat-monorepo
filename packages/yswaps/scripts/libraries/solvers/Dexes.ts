import { ethers } from 'hardhat';
import { SimpleEnabledTrade, Solver } from '../types';
import * as uniswapV2Library from '@libraries/dexes/uniswap-v2';
import { UNISWAP_V2_FACTORY, UNISWAP_V2_ROUTER } from '@deploy/mainnet-swappers/uniswap_v2';
import { IERC20Metadata__factory, TradeFactory } from '@typechained';
import { PopulatedTransaction } from 'ethers';
import * as wallet from '@test-utils/wallet';

export default class Dexes implements Solver {
  async shouldExecuteTrade({ strategy, trades }: { strategy: string; trades: SimpleEnabledTrade[] }): Promise<boolean> {
    if (trades.length != 1) return false;
    const { tokenIn: tokenInAddress } = trades[0];
    const tokenIn = IERC20Metadata__factory.connect(tokenInAddress, wallet.generateRandom());
    const strategyBalance = await tokenIn.balanceOf(strategy);
    return strategyBalance.gt(0);
  }

  async solve({
    strategy,
    trades,
    tradeFactory,
  }: {
    strategy: string;
    trades: SimpleEnabledTrade[];
    tradeFactory: TradeFactory;
  }): Promise<PopulatedTransaction> {
    if (trades.length > 1) throw new Error('Should only be one token in and one token out');
    const { tokenIn: tokenInAddress, tokenOut: tokenOutAddress } = trades[0];
    const uniswapSwapper = await ethers.getContract('AsyncUniswapV2');
    const tokenIn = await IERC20Metadata__factory.connect(tokenInAddress, tradeFactory.signer);
    const amount = await tokenIn.balanceOf(strategy);
    const swapperResponse = await uniswapV2Library.getBestPathEncoded({
      tokenIn: tokenInAddress,
      tokenOut: tokenOutAddress,
      amountIn: amount,
      uniswapV2Router: UNISWAP_V2_ROUTER,
      uniswapV2Factory: UNISWAP_V2_FACTORY,
      slippage: 3,
    });
    const executeTx = await tradeFactory.populateTransaction['execute((address,address,address,uint256,uint256),address,bytes)'](
      {
        _strategy: strategy,
        _tokenIn: tokenInAddress,
        _tokenOut: tokenOutAddress,
        _amount: amount,
        _minAmountOut: swapperResponse.minAmountOut!,
      },
      uniswapSwapper.address,
      swapperResponse.data
    );
    return executeTx;
  }
}
