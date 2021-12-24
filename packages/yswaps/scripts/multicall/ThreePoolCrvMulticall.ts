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
  private threeCrv: string = "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490";
  private yveCrv: string = "0xc5bDdf9843308380375a611c18B50Fb9341f502A";
  private yvBoost: string = "0x9d409a0A012CFbA9B15F6D4B36Ac57A46966Ab9a";
  
  match(trade: PendingTrade) {
    return (trade._strategy == "0xa48c616144FD4429b216A86388CAb0Eed990cE87" &&
      trade._tokenIn == this.threeCrv &&
      trade._tokenOut == this.yveCrv);
  }

  async asyncSwap(trade: PendingTrade): Promise<TradeSetup> {
    const strategy: Signer = await impersonate(trade._strategy);
    const crv3Pool: ICurveFi = ICurveFi__factory.connect('0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7', strategy);
    const usdc: IERC20 = IERC20__factory.connect('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', strategy);
    const yvBoostToken: IERC20 = IERC20__factory.connect(this.yvBoost, strategy);

    // TODO: Remove this. We are just sending from a whale to test this implementation
    const threeCrvWhale: Signer = await impersonate("0x8474DdbE98F5aA3179B3B3F5942D724aFcdec9f6");
    let threeCrvToken: IERC20 = IERC20__factory.connect(this.threeCrv, threeCrvWhale);
    await threeCrvToken.transfer(await strategy.getAddress(), trade._amountIn);

    // Withdraw usdc from crv3Pool
    await crv3Pool.remove_liquidity_one_coin(trade._amountIn, 1, 0);
    const usdcBalance: BigNumber = await usdc.balanceOf(await strategy.getAddress());
    console.log("Got USDC", usdcBalance.toString());


    const { data: zrxData, minAmountOut: zrxMinAmountOut, allowanceTarget:zrxAllowanceTarget } = await zrx.quote({
      chainId: Number(1),
      sellToken: usdc.address,
      buyToken: this.yvBoost,
      sellAmount: usdcBalance,
      slippagePercentage: 3 / 100,
    });

    console.log('zrx:', zrxMinAmountOut?.div(utils.parseEther("1")).toString());
    console.log('zrx allowance target:', zrxAllowanceTarget);
    const zrxContract: string = "0xDef1C0ded9bec7F1a1670819833240f027b25EfF";
    const tx = {
      to: zrxContract,
      data: zrxData,
      value: 0
    }

    await usdc.approve(zrxAllowanceTarget, constants.MaxUint256);
    await strategy.sendTransaction(tx);

    const yvBoostBalance: BigNumber = await yvBoostToken.balanceOf(await strategy.getAddress());
    console.log("Balance: ", yvBoostBalance.toString());

    const yvBoostVault: IVault = IVault__factory.connect(this.yvBoost, strategy);
    await yvBoostVault.withdraw(constants.MaxUint256, await strategy.getAddress(), BigNumber.from("0"))
    
    const yveCrvToken: IERC20 = IERC20__factory.connect(this.yveCrv, strategy);
    const yveCrvBalance: BigNumber = await yveCrvToken.balanceOf(await strategy.getAddress());
    console.log("Got yveCrv", yveCrvBalance.toString());

    // Create txs for multichain swapper
    const transactions: PopulatedTransaction[] = [];
    const multicallSwapper: string = "0xFEB4acf3df3cDEA7399794D0869ef76A6EfAff52";

    threeCrvToken = IERC20__factory.connect(this.threeCrv, strategy);

    // 1) Transfer from the strategy to the swapper
    transactions.push(await threeCrvToken.populateTransaction.transfer(multicallSwapper, trade._amountIn));

    // 2) Withdraw usdc from 3pool
    transactions.push(await crv3Pool.populateTransaction.remove_liquidity_one_coin(trade._amountIn, 1, 0));
    
    // 3) Approve usdc in zrx
    transactions.push(await usdc.populateTransaction.approve(zrxAllowanceTarget, constants.MaxUint256));

    // 4) Swap usdc for yvBOOST
    // TODO: Figure out how to do a populate tx of a sendTX
    //transactions.push(await strategy.populateTransaction.sendTransaction(tx));

    // 5) Withdraw from yvBOOST
    transactions.push(await yvBoostVault.populateTransaction.withdraw(constants.MaxUint256, await strategy.getAddress(), BigNumber.from("0")));

    const data: string = mergeTransactions(transactions, true);
    console.log("mergedTxs:", data);

    return {
      swapper: '0x0-multichain',
      data: data,
      minAmountOut: yveCrvBalance,
    };
  }
}
