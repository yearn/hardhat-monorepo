import { BigNumber, constants, ethers, PopulatedTransaction, Signer, utils } from 'ethers';
import { PendingTrade, TradeSetup } from '@scripts/types';
import { IMulticall } from './IMulticall';
import { ICurveFi, ICurveFi__factory, IERC20, IERC20__factory, IVault, IVault__factory } from '@typechained';
import { impersonate } from '../utils';
import zrx from '../libraries/zrx';
import { mergeTransactions } from '@scripts/libraries/multicall';

// 1) 3pool => [usdc|usdt|dai]
// 2) [usdc|usdt|dai] => yvBOOST
// 3) yvBOOST withdraw  => yveCRV

export class ThreePoolCrvMulticall implements IMulticall {
  private threeCrv: string = '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490';
  private yveCrv: string = '0xc5bDdf9843308380375a611c18B50Fb9341f502A';
  private yvBoost: string = '0x9d409a0A012CFbA9B15F6D4B36Ac57A46966Ab9a';
  private strategy: string = '0x91C3424A608439FBf3A91B6d954aF0577C1B9B8A';
  private crv3Pool: string = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7';
  private usdc: string = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  private multicallSwapper: string = '0xceB202F25B50e8fAF212dE3CA6C53512C37a01D2';
  private zrxContract: string = '0xDef1C0ded9bec7F1a1670819833240f027b25EfF';

  match(trade: PendingTrade) {
    return trade._strategy == this.strategy && trade._tokenIn == this.threeCrv && trade._tokenOut == this.yveCrv;
  }

  async asyncSwap(trade: PendingTrade): Promise<TradeSetup> {
    const strategySigner: Signer = await impersonate(this.strategy);
    const multicallSwapperSigner: Signer = await impersonate(this.multicallSwapper);
    const crv3Pool: ICurveFi = ICurveFi__factory.connect(this.crv3Pool, multicallSwapperSigner);
    const threeCrv: IERC20 = IERC20__factory.connect(this.threeCrv, strategySigner);
    const usdc: IERC20 = IERC20__factory.connect(this.usdc, multicallSwapperSigner);
    const yvBoostToken: IERC20 = IERC20__factory.connect(this.yvBoost, multicallSwapperSigner);
    const yvBoostVault: IVault = IVault__factory.connect(this.yvBoost, multicallSwapperSigner);
    const yveCrvToken: IERC20 = IERC20__factory.connect(this.yveCrv, multicallSwapperSigner);

    console.log('[ThreePoolCrvMulticall] 3crv transfer to swapper');
    await threeCrv.transfer(this.multicallSwapper, trade._amountIn);

    // Withdraw usdc from crv3Pool
    console.log('[ThreePoolCrvMulticall] Remove liqudity from curve pool');
    const usdcBalancePre: BigNumber = await usdc.balanceOf(this.multicallSwapper);
    await crv3Pool.remove_liquidity_one_coin(trade._amountIn, 1, 0);
    const usdcBalanceTotal: BigNumber = await usdc.balanceOf(this.multicallSwapper);
    let usdcBalance: BigNumber = usdcBalanceTotal.sub(usdcBalancePre);
    if (usdcBalanceTotal.eq(usdcBalance)) {
      // we need to leave at least 1 wei as dust for gas optimizations
      usdcBalance = usdcBalance.sub(1);
    }
    console.log(
      '[ThreePoolCrvMulticall] Total USDC after removing liquidity form curve pool',
      utils.formatUnits(usdcBalance, 6),
      `(raw: ${usdcBalance.toString()})`
    );

    // Trade USDC for yvBOOST in zrx
    const { data: zrxData, allowanceTarget: zrxAllowanceTarget } = await zrx.quote({
      chainId: Number(1),
      sellToken: this.usdc,
      buyToken: this.yvBoost,
      sellAmount: usdcBalance,
      slippagePercentage: 10 / 100,
    });

    console.log('[ThreePoolCrvMulticall] Got quote from ZRX');

    const tx = {
      to: this.zrxContract,
      data: zrxData,
    };

    const approveUsdc = (await usdc.allowance(this.multicallSwapper, zrxAllowanceTarget)) < usdcBalance;
    if (approveUsdc) {
      console.log('[ThreePoolCrvMulticall] Approving usdc');
      await usdc.approve(zrxAllowanceTarget, constants.MaxUint256);
    }

    console.log('[ThreePoolCrvMulticall] Executing ZRX swap');
    await multicallSwapperSigner.sendTransaction(tx);

    const yvBoostBalance: BigNumber = await yvBoostToken.balanceOf(this.multicallSwapper);
    console.log('[ThreePoolCrvMulticall] yvBOOST after swap: ', utils.formatEther(yvBoostBalance), `(raw: ${yvBoostBalance.toString()})`);

    console.log('[ThreePoolCrvMulticall] Withdrawing yvBOOST');
    await yvBoostVault.withdraw(constants.MaxUint256, this.multicallSwapper, 0);

    const yveCrvBalance: BigNumber = await yveCrvToken.balanceOf(this.multicallSwapper);
    console.log('[ThreePoolCrvMulticall] yveCRV after withdraw', utils.formatEther(yveCrvBalance), `(raw: ${yveCrvBalance.toString()})`);

    // Create txs for multichain swapper
    const transactions: PopulatedTransaction[] = [];

    // 1) Withdraw usdc from 3pool
    transactions.push(await crv3Pool.populateTransaction.remove_liquidity_one_coin(trade._amountIn, 1, 0));

    // 2) Approve usdc in zrx (if neccesary)
    if (approveUsdc) transactions.push(await usdc.populateTransaction.approve(zrxAllowanceTarget, constants.MaxUint256));

    // 3) Swap usdc for yvBOOST
    transactions.push(tx);

    // 4) Withdraw from yvBOOST
    transactions.push(await yvBoostVault.populateTransaction.withdraw(constants.MaxUint256, this.strategy, BigNumber.from('0')));

    const data: string = mergeTransactions(transactions);
    console.log('[ThreePoolCrvMulticall] Data after merging transactions:', data);

    return {
      swapper: this.multicallSwapper,
      swapperName: 'MultiCallOptimizedSwapper',
      data: data,
      minAmountOut: yveCrvBalance,
    };
  }
}
