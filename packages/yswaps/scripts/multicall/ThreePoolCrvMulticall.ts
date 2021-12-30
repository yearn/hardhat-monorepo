import { BigNumber, constants, PopulatedTransaction, Signer, utils } from 'ethers';
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
    const crv3Pool: ICurveFi = ICurveFi__factory.connect(this.crv3Pool, strategySigner);
    const usdc: IERC20 = IERC20__factory.connect(this.usdc, strategySigner);
    const yvBoostToken: IERC20 = IERC20__factory.connect(this.yvBoost, strategySigner);

    // Withdraw usdc from crv3Pool
    await crv3Pool.remove_liquidity_one_coin(trade._amountIn, 1, 0);
    const usdcBalance: BigNumber = await usdc.balanceOf(this.strategy);
    console.log('Got USDC', usdcBalance.toString());

    // Trade USDC for yvBOOST in zrx
    const {
      data: zrxData,
      allowanceTarget: zrxAllowanceTarget,
    } = await zrx.quote({
      chainId: Number(1),
      sellToken: usdc.address,
      buyToken: this.yvBoost,
      sellAmount: usdcBalance,
      slippagePercentage: 3 / 100,
    });

    const tx = {
      to: this.zrxContract,
      data: zrxData,
    };

    await usdc.approve(zrxAllowanceTarget, constants.MaxUint256);
    await strategySigner.sendTransaction(tx);

    const yvBoostBalance: BigNumber = await yvBoostToken.balanceOf(this.strategy);
    console.log('yvBOOST balance: ', yvBoostBalance.toString());

    const yvBoostVault: IVault = IVault__factory.connect(this.yvBoost, strategySigner);
    await yvBoostVault.withdraw(constants.MaxUint256, this.strategy, BigNumber.from('0'));

    const yveCrvToken: IERC20 = IERC20__factory.connect(this.yveCrv, strategySigner);
    const yveCrvBalance: BigNumber = await yveCrvToken.balanceOf(this.strategy);
    console.log('Got yveCrv', yveCrvBalance.toString());

    // Create txs for multichain swapper
    const transactions: PopulatedTransaction[] = [];

    // 1) Withdraw usdc from 3pool
    transactions.push(await crv3Pool.populateTransaction.remove_liquidity_one_coin(trade._amountIn, 1, 0));

    // 2) Approve usdc in zrx
    transactions.push(await usdc.populateTransaction.approve(zrxAllowanceTarget, constants.MaxUint256));

    // 3) Swap usdc for yvBOOST
    transactions.push(tx);

    // 4) Withdraw from yvBOOST
    transactions.push(await yvBoostVault.populateTransaction.withdraw(constants.MaxUint256, this.strategy, BigNumber.from('0')));

    const data: string = mergeTransactions(transactions);
    console.log('mergedTxs:', data);

    return {
      swapper: this.multicallSwapper,
      swapperName: "Multicall-Swapper",
      data: data,
      minAmountOut: yveCrvBalance,
    };
  }
}
