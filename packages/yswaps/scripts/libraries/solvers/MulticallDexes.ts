import { ethers } from 'hardhat';
import { DexLibrarySwapResponse, SimpleEnabledTrade, Solver, Solvers } from '../types';
import { shouldExecuteTrade } from '@scripts/libraries/utils/should-execute-trade';
import { IERC20Metadata__factory, TradeFactory } from '@typechained';
import { PopulatedTransaction, utils } from 'ethers';
import * as wallet from '@test-utils/wallet';
import { NETWORK_NAME_IDS, SUPPORTED_NETWORKS } from '../../../../commons/utils/network';
import { dexesNerworkMapMock, SUPPORTED_NETWORKS_MOCK } from '../utils/dexes-libraries-mock';
import { mergeTransactions } from '../utils/multicall';

export type MultiDexesSolverMetadata = {
  hopTokens: string[];
};
export default class MulticallDexes implements Solver {
  async shouldExecuteTrade({ strategy, trade }: { strategy: string; trade: SimpleEnabledTrade }): Promise<boolean> {
    return shouldExecuteTrade({ strategy, trade });
  }

  async solve({
    strategy,
    trade,
    metadata,
    tradeFactory,
  }: {
    strategy: string;
    trade: SimpleEnabledTrade;
    metadata: MultiDexesSolverMetadata;
    tradeFactory: TradeFactory;
  }): Promise<PopulatedTransaction> {
    const { tokenIn: tokenInAddress, tokenOut: tokenOutAddress } = trade;
    const { hopTokens } =  metadata;
    if (!hopTokens.length) throw new Error('At least one hop token is required to use MulticallDexes');

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
    const dexes = Object.values(dexesNerworkMapMock[network]);
    const dexesBestResults: DexLibrarySwapResponse[] = []; // index will represent the path order.

    // pair in: tokenIn + hopToken
    for (const hopToken of hopTokens) {
      for (const dex of dexes) {
        const response = await dex.swap({
          tokenIn: tokenInAddress,
          tokenOut: hopToken,
          amountIn: amount,
          strategy,
        });

        const bestResponse = dexesBestResults[0];
        if (!bestResponse || response.amountOut.gt(bestResponse.amountOut)) {
          dexesBestResults[0] = response;
        };
      };
    };

    // pair out: hopToken + tokenOut
    for (const hopToken of hopTokens) {
      const firstPathResponse = dexesBestResults[0];
      for (const dex of dexes) {
        const response = await dex.swap({
          tokenIn: hopToken,
          tokenOut: tokenOutAddress,
          amountIn: firstPathResponse.amountOut,
          strategy,
        });

        const bestResponse = dexesBestResults[1];
        if (!bestResponse || response.amountOut.gt(bestResponse.amountOut)) {
          dexesBestResults[1] = response;
        };
      };
    };

    // check if both paths uses same dex.
    // If so, merge them into one.

    const firstSwapResponse = dexesBestResults[0];
    const lastSwapResponse = dexesBestResults[1];


    const amountOut = lastSwapResponse.amountOut;

    const minAmountOut = amountOut.sub(amountOut.mul(3).div(100));

    const data = mergeTransactions(dexesBestResults.map((result => result.unsignedSwapTx)));

    console.log('[Dexes] Calculated min amount', utils.formatUnits(amountOut, outDecimals), outSymbol);

    // we need to use the helper function used on CrvYfiEth to compare tx and use execute(detail) or execute(detail[])
    const executeTx = await tradeFactory.populateTransaction['execute((address,address,address,uint256,uint256),address,bytes)'](
      {
        _strategy: strategy,
        _tokenIn: tokenInAddress,
        _tokenOut: tokenOutAddress,
        _amount: amount,
        _minAmountOut: minAmountOut,
      },
      multicallSwapperAddress,
      data
    );

    if (amountOut.eq(0)) throw new Error(`No ${outSymbol} tokens were received`);

    return executeTx;

  }
}
