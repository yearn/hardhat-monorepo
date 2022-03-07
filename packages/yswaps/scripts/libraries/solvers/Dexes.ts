import { ethers } from 'hardhat';
import { SimpleEnabledTrade, Solver } from '../types';
import * as uniswapV2Library from '@libraries/dexes/uniswap-v2';
import zrx from '@libraries/dexes/zrx';
import { UNISWAP_V2_FACTORY, UNISWAP_V2_ROUTER } from '@deploy/mainnet-swappers/uniswap_v2';
import { IERC20Metadata__factory, TradeFactory } from '@typechained';
import { BigNumber, PopulatedTransaction, utils } from 'ethers';
import * as wallet from '@test-utils/wallet';

export default class Dexes implements Solver {
  async shouldExecuteTrade({
    strategy,
    trades,
    dustThreshold,
  }: {
    strategy: string;
    trades: SimpleEnabledTrade[];
    dustThreshold: BigNumber;
  }): Promise<boolean> {
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
    dustThreshold,
  }: {
    strategy: string;
    trades: SimpleEnabledTrade[];
    tradeFactory: TradeFactory;
    dustThreshold: BigNumber;
  }): Promise<PopulatedTransaction> {
    if (trades.length > 1) throw new Error('Should only be one token in and one token out');
    const { tokenIn: tokenInAddress, tokenOut: tokenOutAddress } = trades[0];
    const zrxSwapper = await ethers.getContract('ZRX');
    const tokenIn = await IERC20Metadata__factory.connect(tokenInAddress, tradeFactory.signer);
    const inSymbol = await tokenIn.symbol();
    const tokenOut = await IERC20Metadata__factory.connect(tokenOutAddress, tradeFactory.signer);
    const outSymbol = await tokenOut.symbol();
    const amount = await tokenIn.balanceOf(strategy);

    console.log('[Dexes] Getting', inSymbol, '=>', outSymbol, 'trade information');
    const { data: zrxData, minAmountOut: zrxMinAmountOut } = await zrx.quote({
      chainId: 250,
      sellToken: tokenInAddress,
      buyToken: tokenOutAddress,
      sellAmount: amount,
      slippagePercentage: 1 / 100,
      skipValidation: true,
      takerAddress: strategy,
    });

    console.log('[Dexes] Calculated min amount', utils.formatEther(zrxMinAmountOut!), outSymbol);
    const executeTx = await tradeFactory.populateTransaction['execute((address,address,address,uint256,uint256),address,bytes)'](
      {
        _strategy: strategy,
        _tokenIn: tokenInAddress,
        _tokenOut: tokenOutAddress,
        _amount: amount,
        _minAmountOut: zrxMinAmountOut!,
      },
      zrxSwapper.address,
      zrxData
    );

    if (zrxMinAmountOut!.eq(0)) throw new Error(`No ${outSymbol} tokens were received`);

    return executeTx;
  }
}
