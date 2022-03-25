import { ethers } from 'hardhat';
import { DexLibrarySwapResponse, SimpleEnabledTrade, Solver, Solvers } from '../types';
import { shouldExecuteTrade } from '@scripts/libraries/utils/should-execute-trade';
import { IERC20Metadata__factory, TradeFactory } from '@typechained';
import { BigNumber, PopulatedTransaction, utils } from 'ethers';
import * as wallet from '@test-utils/wallet';
import { NETWORK_NAME_IDS, SUPPORTED_NETWORKS } from '../../../../commons/utils/network';
import { dexesNerworkMapMock, FANTOM_DEXES, MAINNET_DEXES, SUPPORTED_NETWORKS_MOCK } from '../utils/dexes-libraries-mock';
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
    const dexesMap = dexesNerworkMapMock[network];
    const dexes = Object.values(dexesMap);
    const dexesBestResults: DexLibrarySwapResponse[] = []; // index will represent the path order.

    // PAIR-IN: tokenIn + hopToken
    // For optimization we first create an array of all the promises for the first path requests.
    const firstPathPromises = hopTokens.map((hopToken) => {
      return dexes.map((dex) => {
        return dex.swap({
          tokenIn: tokenInAddress,
          tokenOut: hopToken,
          amountIn: amount,
          strategy,
        });
      })
    }).flat();

    // we call all the promises at onces.
    let firstBestResponse: DexLibrarySwapResponse;
    const firstPathResponses = await Promise.all(firstPathPromises);
    firstPathResponses.forEach((response) => {
      if (!firstBestResponse || response.amountOut.gt(firstBestResponse.amountOut)) {
        dexesBestResults[0] = response;
      };
    });

    // PAIR-OUT: hopToken + tokenOut
    // For optimization we first create an array of all the promises for the last path requests.
    const lastPathPromises = hopTokens.map((hopToken) => {
      return dexes.map((dex) => {
        return dex.swap({
          tokenIn: tokenInAddress,
          tokenOut: hopToken,
          amountIn: amount,
          strategy,
        });
      })
    }).flat();

    // we call all the promises at onces.
    let lastBestResponse: DexLibrarySwapResponse;
    const lastPathResponses = await Promise.all(lastPathPromises);
    lastPathResponses.forEach((response) => {
      if (!lastBestResponse || response.amountOut.gt(lastBestResponse.amountOut)) {
        dexesBestResults[0] = response;
      };
    });

    const firstSwapResponse = dexesBestResults[0];
    const lastSwapResponse = dexesBestResults[1];

    // TODO: check if both paths uses same dex.
    let uniqueSwapResponse: DexLibrarySwapResponse | undefined;
    if (firstSwapResponse.dex === lastSwapResponse.dex) {
      // NOTE first draft, could change.
      // const dex = dexesMap[firstSwapResponse.dex];
      // uniqueSwapResponse = await dex.swap({
      //     tokenIn: tokenInAddress,
      //     tokenOut: tokenOutAddress,
      //     amountIn: amount,
      //     strategy,
      //   });
    }

    const amountOut = uniqueSwapResponse ? uniqueSwapResponse.amountOut: lastSwapResponse.amountOut;
    const minAmountOut = amountOut.sub(amountOut.mul(3).div(100));
    const data = uniqueSwapResponse
      ? mergeTransactions([uniqueSwapResponse.unsignedSwapTx]) // TODO check if theres a util for single tx
      : mergeTransactions(dexesBestResults.map((result => result.unsignedSwapTx)));

    const multicallSwapper = await ethers.getContract('MultiCallOptimizedSwapper');
    const swapperAddress = uniqueSwapResponse
      ? uniqueSwapResponse.swapperAddress
      : multicallSwapper.address;

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
      data
    );

    if (amountOut.eq(0)) throw new Error(`No ${outSymbol} tokens were received`);

    return executeTx;

  }
}
