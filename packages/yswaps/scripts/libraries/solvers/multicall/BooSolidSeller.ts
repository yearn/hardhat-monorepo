import _ from 'lodash';
import { utils, BigNumber, constants, PopulatedTransaction } from 'ethers';
import { IUniswapV2Router02__factory, IERC20__factory, IWETH__factory, TradeFactory, ISolidlyRouter__factory } from '@typechained';
import { mergeTransactions } from '@scripts/libraries/utils/multicall';
import { impersonate } from '@test-utils/wallet';
import { SimpleEnabledTrade, Solver } from '@scripts/libraries/types';
import { shouldExecuteTrade } from '@scripts/libraries/utils/should-execute-trade';
import * as wallet from '@test-utils/wallet';
import { ethers } from 'hardhat';

// 1) solid => boo with spookyswap

export class BooSolidSeller implements Solver {
  private spookyRouter = '0xF491e7B69E4244ad4002BC14e878a34207E38c29';
  private solidlyRouter = '0xa38cd27185a464914D3046f0AB9d43356B34829D';
  private solidAddress = '0x888EF71766ca594DED1F0FA3AE64eD2941740A20';
  private booAddress = '0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE';
  private wftmAddress = '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83';

  async shouldExecuteTrade({ strategy, trades }: { strategy: string; trades: SimpleEnabledTrade[] }): Promise<boolean> {
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
    const multicallSwapperAddress = (await ethers.getContract('MultiCallOptimizedSwapper')).address;
    const strategySigner = await impersonate(strategy);
    const solidFromStrat = IERC20__factory.connect(this.solidAddress, strategySigner);

    const multicallSwapperSigner = await impersonate(multicallSwapperAddress);
    const solid = IERC20__factory.connect(this.solidAddress, multicallSwapperSigner);

    const boo = IERC20__factory.connect(this.booAddress, multicallSwapperSigner);
    const wftm = IWETH__factory.connect(this.wftmAddress, multicallSwapperSigner);
    const spookyRouter = IUniswapV2Router02__factory.connect(this.spookyRouter, multicallSwapperSigner);
    const solidlyRouter = ISolidlyRouter__factory.connect(this.solidlyRouter, multicallSwapperSigner);

    const solidBalance = (await solid.balanceOf(strategy)).sub(1);
    console.log('[BooSolidSeller] Total balance is', utils.formatEther(solidBalance), 'solid');

    console.log('[BooSolidSeller] Transfering solid to multicall swapper for simulations');
    await solidFromStrat.transfer(multicallSwapperAddress, solidBalance);

    const transactions: PopulatedTransaction[] = [];

    console.log('[BooSolidSeller] Getting solid => wftm trade information');
    const path = [
      {
        from: solid.address,
        to: wftm.address,
        stable: false,
      },
    ];
    let calculatedWftmAmount = (await solidlyRouter.getAmountsOut(solidBalance, path))[1];
    calculatedWftmAmount = calculatedWftmAmount.sub(calculatedWftmAmount.div(100).mul(1).div(2));
    console.log('[BooSolidSeller] Expected wftm', utils.formatEther(calculatedWftmAmount), 'from solid => wft trade');

    const approveSolid = (await solid.allowance(multicallSwapperAddress, this.solidlyRouter)).lt(solidBalance);
    if (approveSolid) {
      console.log('[BooSolidSeller] Approving solid to solidly router');
      const approveSolidTx = await solid.populateTransaction.approve(this.solidlyRouter, constants.MaxUint256);
      await multicallSwapperSigner.sendTransaction(approveSolidTx);
      transactions.push(approveSolidTx);
    }

    console.log('[BooSolidSeller] Executing solid => wftm through solidly');
    const sellSolidToWftmTx = await solidlyRouter.populateTransaction.swapExactTokensForTokens(
      solidBalance,
      calculatedWftmAmount,
      path,
      multicallSwapperAddress,
      constants.MaxUint256
    );
    await multicallSwapperSigner.sendTransaction(sellSolidToWftmTx);
    transactions.push(sellSolidToWftmTx);

    console.log('[BooSolidSeller] Getting wftm => boo trade information');
    const pathSpooky = [wftm.address, this.booAddress];
    let calculatedBooAmount = (await spookyRouter.getAmountsOut(calculatedWftmAmount, pathSpooky))[1];
    calculatedBooAmount = calculatedBooAmount.sub(calculatedBooAmount.div(100).mul(1).div(2));
    console.log('[BooSolidSeller] Expected boo', utils.formatEther(calculatedBooAmount), 'from wftm => boo trade');

    const approveWftmSpooky = (await wftm.allowance(multicallSwapperAddress, this.spookyRouter)).lt(calculatedWftmAmount);
    if (approveWftmSpooky) {
      console.log('[BooSolidSeller] Approving wftm to spooky');
      const approveWftmTx = await wftm.populateTransaction.approve(this.spookyRouter, constants.MaxUint256);
      await multicallSwapperSigner.sendTransaction(approveWftmTx);
      transactions.push(approveWftmTx);
    }

    console.log('[BooSolidSeller] Executing wftm => boo through spooky');
    const sellWftmToBooTx = await spookyRouter.populateTransaction.swapExactTokensForTokens(
      calculatedWftmAmount,
      calculatedBooAmount,
      pathSpooky,
      strategy,
      constants.MaxUint256
    );
    await multicallSwapperSigner.sendTransaction(sellWftmToBooTx);
    transactions.push(sellWftmToBooTx);

    const amountOut = await boo.balanceOf(strategy);
    console.log('[BooSolidSeller] Final boo balance is', utils.formatEther(amountOut));

    if (amountOut.eq(0)) throw new Error('No boo tokens were received');

    const data = mergeTransactions(transactions);

    const executeTx = await tradeFactory.populateTransaction['execute((address,address,address,uint256,uint256),address,bytes)'](
      {
        _strategy: strategy,
        _tokenIn: this.solidAddress,
        _tokenOut: this.booAddress,
        _amount: solidBalance,
        _minAmountOut: calculatedBooAmount,
      },
      multicallSwapperAddress,
      data
    );

    return executeTx;
  }
}
