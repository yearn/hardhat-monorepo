import { ethers } from 'hardhat';
import { SimpleEnabledTrade, Solver } from '../types';
import * as solidlyLibrary from '@libraries/dexes/solidly';
import { SOLIDLY_FACTORY, SOLIDLY_ROUTER } from '@deploy/fantom-swappers/solidly';
import { shouldExecuteTrade } from '@scripts/libraries/utils/should-execute-trade';
import { IERC20Metadata__factory, TradeFactory } from '@typechained';
import { PopulatedTransaction, utils } from 'ethers';
import * as wallet from '@test-utils/wallet';
import { NETWORK_NAME_IDS, SUPPORTED_NETWORKS } from '../../../../commons/utils/network';

export default class SolidlySolver implements Solver {
  async shouldExecuteTrade({ strategy, trades }: { strategy: string; trades: SimpleEnabledTrade[] }): Promise<boolean> {
    if (trades.length != 1) return false;
    return shouldExecuteTrade({ strategy, trades, checkType: 'total' });
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
    const solidlySwapper = await ethers.getContract('AsyncSolidly');
    const tokenIn = await IERC20Metadata__factory.connect(tokenInAddress, tradeFactory.signer);
    const inSymbol = await tokenIn.symbol();
    const tokenOut = await IERC20Metadata__factory.connect(tokenOutAddress, tradeFactory.signer);
    const outSymbol = await tokenOut.symbol();
    const outDecimals = await tokenOut.decimals();
    const amount = await tokenIn.balanceOf(strategy);

    console.log('[SolidlySolver] Getting', inSymbol, '=>', outSymbol, 'trade information');
    const swapperResponse = await solidlyLibrary.getBestPathEncoded({
      tokenIn: tokenInAddress,
      tokenOut: tokenOutAddress,
      amountIn: amount,
      solidlyFactory: SOLIDLY_FACTORY,
      solidlyRouter: SOLIDLY_ROUTER,
      slippage: 3,
    });

    console.log('[SolidlySolver] Calculated min amount', utils.formatUnits(swapperResponse.minAmountOut!, outDecimals), outSymbol);
    const executeTx = await tradeFactory.populateTransaction['execute((address,address,address,uint256,uint256),address,bytes)'](
      {
        _strategy: strategy,
        _tokenIn: tokenInAddress,
        _tokenOut: tokenOutAddress,
        _amount: amount,
        _minAmountOut: swapperResponse.minAmountOut!,
      },
      solidlySwapper.address,
      swapperResponse.data
    );

    if (swapperResponse.minAmountOut!.eq(0)) throw new Error(`No ${outSymbol} tokens were received`);

    return executeTx;
  }
}
