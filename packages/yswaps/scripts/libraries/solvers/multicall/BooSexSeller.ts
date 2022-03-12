import _ from 'lodash';
import { utils, BigNumber, constants, PopulatedTransaction } from 'ethers';
import { IUniswapV2Router02__factory, IERC20__factory, IWETH__factory, TradeFactory, ISolidlyRouter__factory } from '@typechained';
import { mergeTransactions } from '@scripts/libraries/utils/multicall';
import { impersonate } from '@test-utils/wallet';
import { SimpleEnabledTrade, Solver } from '@scripts/libraries/types';
import { shouldExecuteTrade } from '@scripts/libraries/utils/should-execute-trade';
import * as wallet from '@test-utils/wallet';
import { ethers } from 'hardhat';

const DUST_THRESHOLD = utils.parseEther('250');

// 1) solid => boo with spookyswap

export class BooSexSeller implements Solver {
  private spookyRouter = '0xF491e7B69E4244ad4002BC14e878a34207E38c29';
  private solidlyRouter = '0xa38cd27185a464914D3046f0AB9d43356B34829D';
  private sexAddress = '0xD31Fcd1f7Ba190dBc75354046F6024A9b86014d7';
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
    const sexFromStrat = IERC20__factory.connect(this.sexAddress, strategySigner);

    const multicallSwapperSigner = await impersonate(multicallSwapperAddress);
    const sex = IERC20__factory.connect(this.sexAddress, multicallSwapperSigner);

    const boo = IERC20__factory.connect(this.booAddress, multicallSwapperSigner);
    const wftm = IWETH__factory.connect(this.wftmAddress, multicallSwapperSigner);
    const spookyRouter = IUniswapV2Router02__factory.connect(this.spookyRouter, multicallSwapperSigner);
    const solidlyRouter = ISolidlyRouter__factory.connect(this.solidlyRouter, multicallSwapperSigner);

    const sexBalance = (await sex.balanceOf(strategy)).sub(1);
    console.log('[BooSexSeller] Total balance is', utils.formatEther(sexBalance), 'sex');

    console.log('[BooSexSeller] Transfering sex to multicall swapper for simulations');
    await sexFromStrat.transfer(multicallSwapperAddress, sexBalance);

    const transactions: PopulatedTransaction[] = [];

    console.log('[BooSexSeller] Getting sex => wftm trade information');
    const path = [
      {
        from: sex.address,
        to: wftm.address,
        stable: false,
      },
    ];
    let calculatedWftmAmount = (await solidlyRouter.getAmountsOut(sexBalance, path))[1];
    calculatedWftmAmount = calculatedWftmAmount.sub(calculatedWftmAmount.div(100).mul(1).div(2));
    console.log('[BooSexSeller] Expected wftm', utils.formatEther(calculatedWftmAmount), 'from sex => wft trade');

    const approveSex = (await sex.allowance(multicallSwapperAddress, this.solidlyRouter)).lt(sexBalance);
    if (approveSex) {
      console.log('[BooSexSeller] Approving sex to solidly router');
      const approveSexTx = await sex.populateTransaction.approve(this.solidlyRouter, constants.MaxUint256);
      await multicallSwapperSigner.sendTransaction(approveSexTx);
      transactions.push(approveSexTx);
    }

    console.log('[BooSexSeller] Executing sex => wftm through solidly');
    const sellSexToWftmTx = await solidlyRouter.populateTransaction.swapExactTokensForTokens(
      sexBalance,
      calculatedWftmAmount,
      path,
      multicallSwapperAddress,
      constants.MaxUint256
    );
    await multicallSwapperSigner.sendTransaction(sellSexToWftmTx);
    transactions.push(sellSexToWftmTx);

    console.log('[BooSexSeller] Getting wftm => boo trade information');
    const pathSpooky = [wftm.address, this.booAddress];
    let calculatedBooAmount = (await spookyRouter.getAmountsOut(calculatedWftmAmount, pathSpooky))[1];
    calculatedBooAmount = calculatedBooAmount.sub(calculatedBooAmount.div(100).mul(1).div(2));
    console.log('[BooSexSeller] Expected boo', utils.formatEther(calculatedBooAmount), 'from wftm => boo trade');

    const approveWftmSpooky = (await wftm.allowance(multicallSwapperAddress, this.spookyRouter)).lt(calculatedWftmAmount);
    if (approveWftmSpooky) {
      console.log('[BooSexSeller] Approving wftm to spooky');
      const approveWftmTx = await wftm.populateTransaction.approve(this.spookyRouter, constants.MaxUint256);
      await multicallSwapperSigner.sendTransaction(approveWftmTx);
      transactions.push(approveWftmTx);
    }

    console.log('[BooSexSeller] Executing wftm => boo through spooky');
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
    console.log('[BooSexSeller] Final boo balance is', utils.formatEther(amountOut));

    if (amountOut.eq(0)) throw new Error('No boo tokens were received');

    const data = mergeTransactions(transactions);

    const executeTx = await tradeFactory.populateTransaction['execute((address,address,address,uint256,uint256),address,bytes)'](
      {
        _strategy: strategy,
        _tokenIn: this.sexAddress,
        _tokenOut: this.booAddress,
        _amount: sexBalance,
        _minAmountOut: calculatedBooAmount,
      },
      multicallSwapperAddress,
      data
    );

    return executeTx;
  }
}
