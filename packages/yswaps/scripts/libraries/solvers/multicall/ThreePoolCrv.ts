import { BigNumber, constants, PopulatedTransaction, utils } from 'ethers';
import { ICurveFi__factory, IERC20__factory, IVault__factory, TradeFactory } from '@typechained';
import zrx from '@libraries/dexes/zrx';
import { mergeTransactions } from '@scripts/libraries/utils/multicall';
import { impersonate } from '@test-utils/wallet';
import { SimpleEnabledTrade, Solver } from '@scripts/libraries/types';
import * as wallet from '@test-utils/wallet';

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
  private multicallSwapperAddress = '0xceB202F25B50e8fAF212dE3CA6C53512C37a01D2';
  private zrxContractAddress = '0xDef1C0ded9bec7F1a1670819833240f027b25EfF';

  async shouldExecuteTrade({ strategy, trades }: { strategy: string; trades: SimpleEnabledTrade[] }): Promise<boolean> {
    if (trades.length != 1) return false;
    const threeCrv = IERC20__factory.connect(this.threeCrvAddress, wallet.generateRandom());
    const strategyBalance = await threeCrv.balanceOf(strategy);
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
    // TODO: Check token in == threeCrv and token out == yvBoose

    const strategySigner = await impersonate(this.strategyAddress);
    const multicallSwapperSigner = await impersonate(this.multicallSwapperAddress);
    const crv3Pool = ICurveFi__factory.connect(this.crv3PoolAddress, multicallSwapperSigner);
    const threeCrv = IERC20__factory.connect(this.threeCrvAddress, strategySigner);
    const usdc = IERC20__factory.connect(this.usdcAddress, multicallSwapperSigner);
    const yvBoostToken = IERC20__factory.connect(this.yvBoostAddress, multicallSwapperSigner);
    const yvBoostVault = IVault__factory.connect(this.yvBoostAddress, multicallSwapperSigner);
    const yveCrvToken = IERC20__factory.connect(this.yveCrvAddress, multicallSwapperSigner);

    const amount = await threeCrv.balanceOf(strategy);
    console.log('[ThreePoolCrv] 3crv transfer to swapper');
    await threeCrv.transfer(this.multicallSwapperAddress, amount);

    // Withdraw usdc from crv3Pool
    console.log('[ThreePoolCrv] Remove liqudity from curve pool');
    const usdcBalancePre = await usdc.balanceOf(this.multicallSwapperAddress);
    await crv3Pool.remove_liquidity_one_coin(amount, 1, 0);
    const usdcBalanceTotal = await usdc.balanceOf(this.multicallSwapperAddress);
    let usdcBalance = usdcBalanceTotal.sub(usdcBalancePre);
    if (usdcBalanceTotal.eq(usdcBalance)) {
      // we need to leave at least 1 wei as dust for gas optimizations
      usdcBalance = usdcBalance.sub(1);
    }
    console.log(
      '[ThreePoolCrv] Total USDC after removing liquidity form curve pool',
      utils.formatUnits(usdcBalance, 6),
      `(raw: ${usdcBalance.toString()})`
    );

    // Trade USDC for yvBOOST in zrx
    const { data: zrxData, allowanceTarget: zrxAllowanceTarget } = await zrx.quote({
      chainId: 1,
      sellToken: this.usdcAddress,
      buyToken: this.yvBoostAddress,
      sellAmount: usdcBalance,
      slippagePercentage: 10 / 100,
    });

    console.log('[ThreePoolCrv] Got quote from ZRX');

    const tx = {
      to: this.zrxContractAddress,
      data: zrxData,
    };

    const approveUsdc = (await usdc.allowance(this.multicallSwapperAddress, zrxAllowanceTarget)) < usdcBalance;
    if (approveUsdc) {
      console.log('[ThreePoolCrv] Approving usdc');
      await usdc.approve(zrxAllowanceTarget, constants.MaxUint256);
    }

    console.log('[ThreePoolCrv] Executing ZRX swap');
    await multicallSwapperSigner.sendTransaction(tx);

    const yvBoostBalance: BigNumber = await yvBoostToken.balanceOf(this.multicallSwapperAddress);
    console.log('[ThreePoolCrv] yvBOOST after swap: ', utils.formatEther(yvBoostBalance), `(raw: ${yvBoostBalance.toString()})`);

    console.log('[ThreePoolCrv] Withdrawing yvBOOST');
    await yvBoostVault.withdraw(constants.MaxUint256, this.multicallSwapperAddress, 0);

    const yveCrvBalance: BigNumber = await yveCrvToken.balanceOf(this.multicallSwapperAddress);
    console.log('[ThreePoolCrv] yveCRV after withdraw', utils.formatEther(yveCrvBalance), `(raw: ${yveCrvBalance.toString()})`);

    // Create txs for multichain swapper
    const transactions: PopulatedTransaction[] = [];

    // 1) Withdraw usdc from 3pool
    transactions.push(await crv3Pool.populateTransaction.remove_liquidity_one_coin(amount, 1, 0));

    // 2) Approve usdc in zrx (if neccesary)
    if (approveUsdc) transactions.push(await usdc.populateTransaction.approve(zrxAllowanceTarget, constants.MaxUint256));

    // 3) Swap usdc for yvBOOST
    transactions.push(tx);

    // 4) Withdraw from yvBOOST
    transactions.push(await yvBoostVault.populateTransaction.withdraw(constants.MaxUint256, this.strategyAddress, BigNumber.from('0')));

    const data: string = mergeTransactions(transactions);

    console.log('[ThreePoolCrv] Data after merging transactions:', data);

    const executeTx = await tradeFactory.populateTransaction['execute((address,address,address,uint256,uint256),address,bytes)'](
      {
        _strategy: strategy,
        _tokenIn: this.threeCrvAddress,
        _tokenOut: this.yvBoostAddress,
        _amount: amount,
        _minAmountOut: yveCrvBalance,
      },
      this.multicallSwapperAddress,
      data
    );

    return executeTx;
  }
}
