import { ethers } from 'hardhat';
import { DexLibrarySwapResponse, SimpleEnabledTrade, Solver } from '../types';
import { shouldExecuteTrade } from '@scripts/libraries/utils/should-execute-trade';
import { IERC20Metadata__factory, TradeFactory } from '@typechained';
import { PopulatedTransaction, utils } from 'ethers';
import * as wallet from '@test-utils/wallet';
import { NETWORK_NAME_IDS, SUPPORTED_NETWORKS } from '../../../../commons/utils/network';
import { dexesNerworkMapMock, SUPPORTED_NETWORKS_MOCK } from '../utils/dexes-libraries-mock';

export default class Dexes implements Solver {
  async shouldExecuteTrade({ strategy, trade }: { strategy: string; trade: SimpleEnabledTrade }): Promise<boolean> {
    return shouldExecuteTrade({ strategy, trade });
  }

  async solve({
    strategy,
    trade,
    tradeFactory,
  }: {
    strategy: string;
    trade: SimpleEnabledTrade;
    tradeFactory: TradeFactory;
  }): Promise<PopulatedTransaction> {
    const { tokenIn: tokenInAddress, tokenOut: tokenOutAddress } = trade;
    const [tokenIn, tokenOut] = await Promise.all([
      IERC20Metadata__factory.connect(tokenInAddress, tradeFactory.signer),
      IERC20Metadata__factory.connect(tokenOutAddress, tradeFactory.signer),
    ]);

    const [inSymbol, outSymbol, amount, inDecimals, outDecimals] = await Promise.all([
      tokenIn.symbol(),
      tokenOut.symbol(),
      (await tokenIn.balanceOf(strategy)).sub(1),
      tokenIn.decimals(),
      tokenOut.decimals(),
    ]);

    console.log('[Dexes] Total balance is', utils.formatUnits(amount, inDecimals), inSymbol);
    console.log('[Dexes] Getting', inSymbol, '=>', outSymbol, 'trade information');

    const network = process.env.HARDHAT_DEPLOY_FORK as SUPPORTED_NETWORKS_MOCK;
    const dexes = dexesNerworkMapMock[network];

    let bestDexResponse: DexLibrarySwapResponse | undefined;

    for (const dex of Object.values(dexes)) {
      const response = await dex.swap({
        amountIn: amount,
        strategy,
        tokenIn: tokenInAddress,
        tokenOut: tokenOutAddress,
      });

      if (!bestDexResponse || response.amountOut.gt(bestDexResponse.amountOut)) {
        bestDexResponse = response;
      }
    }

    if (!bestDexResponse) throw new Error('No valid response from dexes');

    const { amountOut, dex, path, swapperData, unsignedSwapTx, swapperAddress } =  bestDexResponse;
    console.log(`[Dexes] Best calculate amount out`, utils.formatUnits(amountOut, outDecimals), outSymbol, ` from dex: ${dex} using path ${path}`);

    // should we calculate minAmountOut? should slippage be a parameter on trade config?
    const minAmountOut = amountOut.sub(amountOut.mul(3).div(100));

    console.log('[Dexes] Calculated min amount', utils.formatUnits(amountOut, outDecimals), outSymbol);
    const executeTx = await tradeFactory.populateTransaction['execute((address,address,address,uint256,uint256),address,bytes)'](
      {
        _strategy: strategy,
        _tokenIn: tokenInAddress,
        _tokenOut: tokenOutAddress,
        _amount: amount,
        _minAmountOut: minAmountOut,
      },
      swapperAddress,
      swapperData
    );

    if (amountOut.eq(0)) throw new Error(`No ${outSymbol} tokens were received`);

    return executeTx;
  }
}
