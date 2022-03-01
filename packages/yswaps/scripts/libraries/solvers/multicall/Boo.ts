import _ from 'lodash';
import { utils, BigNumber, constants, PopulatedTransaction } from 'ethers';
import { IUniswapV2Router02__factory, IERC20__factory, IWETH__factory, TradeFactory } from '@typechained';
import zrx from '@libraries/dexes/zrx';
import { mergeTransactions } from '@scripts/libraries/utils/multicall';
import { impersonate } from '@test-utils/wallet';
import { SimpleEnabledTrade, Solver } from '@scripts/libraries/types';
import * as wallet from '@test-utils/wallet';
import { ethers } from 'hardhat';

const DUST_THRESHOLD = utils.parseEther('1');

// 1) crv => weth with zrx
// 2) cvx => weth with zrx
// 3) weth => eth with wrapper
// 4) eth => spell/eth with curve

export class BooSolver implements Solver {
  
  private strategyAddress = '0xADE3BaC94177295329474aAd6A253Bae979BFA68'; // boo strat
  private spookyRouter = '0xF491e7B69E4244ad4002BC14e878a34207E38c29';
  private sexAddress = '0xD31Fcd1f7Ba190dBc75354046F6024A9b86014d7';
  private solidAddress = '0x888EF71766ca594DED1F0FA3AE64eD2941740A20';
  private booAddress = '0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE';
  private wftmAddress = '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83';

  async shouldExecuteTrade({ strategy, trades }: { strategy: string; trades: SimpleEnabledTrade[] }): Promise<boolean> {
    const solid = IERC20__factory.connect(this.solidAddress, wallet.generateRandom());
    //const crv = IERC20__factory.connect(this.crvAddress, wallet.generateRandom());
    const solidStrategyBalance = await solid.balanceOf(strategy);
    return solidStrategyBalance.gt(DUST_THRESHOLD);
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
    const strategySigner = await impersonate(this.strategyAddress);
    const solidFromStrat = IERC20__factory.connect(this.solidAddress, strategySigner);


    const multicallSwapperSigner = await impersonate(multicallSwapperAddress);
    const solid = IERC20__factory.connect(this.solidAddress, multicallSwapperSigner);
    
    const boo = IERC20__factory.connect(this.booAddress, multicallSwapperSigner);
    const wftm = IWETH__factory.connect(this.wftmAddress, multicallSwapperSigner);
    const spookyRouter = IUniswapV2Router02__factory.connect(this.spookyRouter, multicallSwapperSigner);

    const solidBalance = (await solid.balanceOf(strategy)).sub(1);
    console.log('[BooSolver] Total Solid balance is', utils.formatEther(solidBalance));
    

    console.log('[BooSolver] Transfering solid to multicall swapper for simulations');
    await solidFromStrat.transfer(multicallSwapperAddress, solidBalance);

    // Create txs for multichain swapper
    const transactions: PopulatedTransaction[] = [];

    const path = [solid.address, wftm.address, boo.address]

    console.log('[BooSolver] Getting sex => boo trade information');
    const outAmount = (await spookyRouter.getAmountsOut(solidBalance, path))[2];

    console.log('[BooSolver] Expected boo out ', utils.formatEther(outAmount));

    const approveSolid = (await solid.allowance(multicallSwapperAddress, spookyRouter.address)).lt(solidBalance);
    if (approveSolid) {
      console.log('[BooSolver] Approving solid');
      const approveSolidTx = await solid.populateTransaction.approve(spookyRouter.address, constants.MaxUint256);
      await multicallSwapperSigner.sendTransaction(approveSolidTx);
      transactions.push(approveSolidTx);
    }

    console.log('[BooSolver] Executing solid => boo');
    const sellSolidTx = await spookyRouter.populateTransaction.swapExactTokensForTokens(solidBalance, outAmount, path, this.strategyAddress, constants.MaxUint256);
    await multicallSwapperSigner.sendTransaction(sellSolidTx);
    transactions.push(sellSolidTx);

    const data = mergeTransactions(transactions);

    const executeTx = await tradeFactory.populateTransaction['execute((address,address,address,uint256,uint256)[],address,bytes)'](
      [
        {
          _strategy: this.strategyAddress,
          _tokenIn: this.solidAddress,
          _tokenOut: this.booAddress,
          _amount: solidBalance,
          _minAmountOut: outAmount,
        }
      ],
      multicallSwapperAddress,
      data
    );

    return executeTx;
  }
}
