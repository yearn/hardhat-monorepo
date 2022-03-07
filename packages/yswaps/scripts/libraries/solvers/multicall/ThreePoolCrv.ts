import { BigNumber, constants, PopulatedTransaction, utils } from 'ethers';
import { ICurveFi__factory, IERC20__factory, IVault__factory, TradeFactory } from '@typechained';
import zrx from '@libraries/dexes/zrx';
import { mergeTransactions } from '@scripts/libraries/utils/multicall';
import { impersonate } from '@test-utils/wallet';
import { SimpleEnabledTrade, Solver } from '@scripts/libraries/types';
import * as wallet from '@test-utils/wallet';
import { ethers } from 'hardhat';

const DUST_THRESHOLD = utils.parseEther('1');

// 1) 3pool => [usdc|usdt|dai]
// 2) [usdc|usdt|dai] => yvBOOST
// 3) yvBOOST withdraw  => yveCRV

export class ThreePoolCrv implements Solver {
  private threeCrvAddress = '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490';
  private yveCrvAddress = '0xc5bDdf9843308380375a611c18B50Fb9341f502A';
  private yvBoostAddress = '0x9d409a0A012CFbA9B15F6D4B36Ac57A46966Ab9a';
  private strategyAddress = '0x91C3424A608439FBf3A91B6d954aF0577C1B9B8A';
  private crv3PoolAddress = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7';
  private usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  private zrxContractAddress = '0xDef1C0ded9bec7F1a1670819833240f027b25EfF';

  async shouldExecuteTrade({ strategy, trades, dustThreshold }: { strategy: string; trades: SimpleEnabledTrade[], dustThreshold: BigNumber }): Promise<boolean> {
    if (trades.length != 1) return false;
    const threeCrv = IERC20__factory.connect(this.threeCrvAddress, wallet.generateRandom());
    const strategyBalance = await threeCrv.balanceOf(strategy);
    return strategyBalance.gt(dustThreshold);
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
    // TODO: Check token in == threeCrv and token out == yvBoose
    const multicallSwapperAddress = (await ethers.getContract('MultiCallOptimizedSwapper')).address;
    const strategySigner = await impersonate(this.strategyAddress);
    const multicallSwapperSigner = await impersonate(multicallSwapperAddress);
    const crv3Pool = ICurveFi__factory.connect(this.crv3PoolAddress, multicallSwapperSigner);
    const threeCrv = IERC20__factory.connect(this.threeCrvAddress, strategySigner);
    const usdc = IERC20__factory.connect(this.usdcAddress, multicallSwapperSigner);
    const yvBoostToken = IERC20__factory.connect(this.yvBoostAddress, multicallSwapperSigner);
    const yvBoostVault = IVault__factory.connect(this.yvBoostAddress, multicallSwapperSigner);
    const yveCrvToken = IERC20__factory.connect(this.yveCrvAddress, multicallSwapperSigner);

    // Create txs for multichain swapper
    const transactions: PopulatedTransaction[] = [];

    const amount = await threeCrv.balanceOf(strategy);
    console.log('[ThreePoolCrv] 3crv transfer to swapper');
    await threeCrv.transfer(multicallSwapperAddress, amount);

    // Withdraw usdc from crv3Pool
    console.log('[ThreePoolCrv] Remove liqudity from curve pool');
    const usdcBalancePre = await usdc.balanceOf(multicallSwapperAddress);

    const removeLiquidityTx = await crv3Pool.populateTransaction.remove_liquidity_one_coin(amount, 1, 0);
    await multicallSwapperSigner.sendTransaction(removeLiquidityTx);
    transactions.push(removeLiquidityTx);

    const usdcBalanceTotal = await usdc.balanceOf(multicallSwapperAddress);
    let usdcBalance = usdcBalanceTotal.sub(usdcBalancePre);
    if (usdcBalanceTotal.eq(usdcBalance)) {
      // we need to leave at least 1 wei as dust for gas optimizations
      usdcBalance = usdcBalance.sub(1);
    }
    console.log(
      '[ThreePoolCrv] Total USDC after removing liquidity from curve pool',
      utils.formatUnits(usdcBalance, 6),
      `(raw: ${usdcBalance.toString()})`
    );

    // Trade USDC for yvBOOST in zrx
    console.log('[ThreePoolCrv] Getting USDC => yvBOOST trade information via zrx');
    const { data: zrxData, allowanceTarget: zrxAllowanceTarget } = await zrx.quote({
      chainId: 1,
      sellToken: this.usdcAddress,
      buyToken: this.yvBoostAddress,
      sellAmount: usdcBalance,
      slippagePercentage: 10 / 100,
    });

    const approveUsdc = (await usdc.allowance(multicallSwapperAddress, zrxAllowanceTarget)).lt(usdcBalance);
    if (approveUsdc) {
      console.log('[ThreePoolCrv] Approving usdc');
      const approveUsdcTx = await usdc.populateTransaction.approve(zrxAllowanceTarget, constants.MaxUint256);
      await multicallSwapperSigner.sendTransaction(approveUsdcTx);
      transactions.push(approveUsdcTx);
    }

    console.log('[ThreePoolCrv] Executing USDC => yvBOOST via zrx');
    const swapTx = {
      to: this.zrxContractAddress,
      data: zrxData,
    };
    await multicallSwapperSigner.sendTransaction(swapTx);
    transactions.push(swapTx);

    const yvBoostBalance: BigNumber = await yvBoostToken.balanceOf(multicallSwapperAddress);
    console.log('[ThreePoolCrv] yvBOOST after swap: ', utils.formatEther(yvBoostBalance), `(raw: ${yvBoostBalance.toString()})`);

    console.log('[ThreePoolCrv] Withdrawing yvBOOST');
    const yvBoostWithdrawTx = await yvBoostVault.populateTransaction.withdraw(constants.MaxUint256, multicallSwapperAddress, 0);
    await multicallSwapperSigner.sendTransaction(yvBoostWithdrawTx);
    transactions.push(yvBoostWithdrawTx);

    const yveCrvBalance: BigNumber = await yveCrvToken.balanceOf(multicallSwapperAddress);
    console.log('[ThreePoolCrv] yveCRV after withdraw', utils.formatEther(yveCrvBalance), `(raw: ${yveCrvBalance.toString()})`);

    const data: string = mergeTransactions(transactions);

    const executeTx = await tradeFactory.populateTransaction['execute((address,address,address,uint256,uint256),address,bytes)'](
      {
        _strategy: strategy,
        _tokenIn: this.threeCrvAddress,
        _tokenOut: this.yvBoostAddress,
        _amount: amount,
        _minAmountOut: yveCrvBalance,
      },
      multicallSwapperAddress,
      data
    );

    return executeTx;
  }
}
