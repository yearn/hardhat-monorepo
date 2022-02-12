import _ from 'lodash';
import { BigNumber, constants, PopulatedTransaction } from 'ethers';
import { ICurveFi__factory, IERC20__factory, IWETH__factory, TradeFactory } from '@typechained';
import zrx from '@libraries/dexes/zrx';
import { mergeTransactions } from '@scripts/libraries/utils/multicall';
import { impersonate } from '@test-utils/wallet';
import { SimpleEnabledTrade, Solver } from '@scripts/libraries/types';
import * as wallet from '@test-utils/wallet';

type Tx = {
  to: string;
  data: string;
};

// 1) crv => weth with zrx
// 2) cvx => weth with zrx
// 3) weth => eth with wrapper
// 4) eth => spell/eth with curve

export class CurveSpellEth implements Solver {
  private crvSpellEthAddress = '0x8282BD15dcA2EA2bDf24163E8f2781B30C43A2ef'; // might not be used
  private strategyAddress = '0xeDB4B647524FC2B9985019190551b197c6AB6C5c';
  private curveSwapAddress = '0x98638FAcf9a3865cd033F36548713183f6996122';
  private crvAddress = '0xD533a949740bb3306d119CC777fa900bA034cd52';
  private cvxAddress = '0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B';
  private wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
  private multicallSwapperAddress = '0x7F036fa7B01E7c0286AFd4c7f756dd367E90a5f8';
  private zrxContractAddress = '0xDef1C0ded9bec7F1a1670819833240f027b25EfF';

  async shouldExecuteTrade({ strategy, trades }: { strategy: string; trades: SimpleEnabledTrade[] }): Promise<boolean> {
    const cvx = IERC20__factory.connect(this.cvxAddress, wallet.generateRandom());
    const crv = IERC20__factory.connect(this.crvAddress, wallet.generateRandom());
    const crvStrategyBalance = await crv.balanceOf(strategy);
    const cvxStrategyBalance = await cvx.balanceOf(strategy);
    return cvxStrategyBalance.gt(0) && crvStrategyBalance.gt(0);
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
    const strategySigner = await impersonate(this.strategyAddress);
    const multicallSwapperSigner = await impersonate(this.multicallSwapperAddress);
    const crvStrategy = IERC20__factory.connect(this.crvAddress, strategySigner);
    const cvxStrategy = IERC20__factory.connect(this.cvxAddress, strategySigner);
    const crv = IERC20__factory.connect(this.crvAddress, multicallSwapperSigner);
    const cvx = IERC20__factory.connect(this.cvxAddress, multicallSwapperSigner);
    const weth = IWETH__factory.connect(this.wethAddress, multicallSwapperSigner);
    const curveSwap = ICurveFi__factory.connect(this.curveSwapAddress, multicallSwapperSigner);

    const crvBalance = await crv.balanceOf(this.strategyAddress);
    const cvxBalance = await cvx.balanceOf(this.strategyAddress);

    console.log('[CurveSpellEth] cvx/crv transfer to swapper for simulations');
    await crvStrategy.transfer(this.multicallSwapperAddress, crvBalance);
    await cvxStrategy.transfer(this.multicallSwapperAddress, cvxBalance);

    console.log('[CurveSpellEth] Trade cvr for weth');
    const { data: zrxCvrData, allowanceTarget: zrxCrvAllowanceTarget } = await zrx.quote({
      chainId: 1,
      sellToken: crv.address,
      buyToken: weth.address,
      sellAmount: crvBalance,
      slippagePercentage: 10 / 100,
    });

    const approveCrv = (await crv.allowance(this.multicallSwapperAddress, zrxCrvAllowanceTarget)) < crvBalance;
    if (approveCrv) await crv.approve(zrxCrvAllowanceTarget, constants.MaxUint256);

    const crvToWethTx: Tx = {
      to: this.zrxContractAddress,
      data: zrxCvrData,
    };
    await multicallSwapperSigner.sendTransaction(crvToWethTx);

    console.log('[CurveSpellEth] Trade cvx for weth');
    const { data: zrxCvxData, allowanceTarget: zrxCvxAllowanceTarget } = await zrx.quote({
      chainId: 1,
      sellToken: cvx.address,
      buyToken: weth.address,
      sellAmount: cvxBalance,
      slippagePercentage: 10 / 100,
    });

    const approveCvx = (await crv.allowance(this.multicallSwapperAddress, zrxCvxAllowanceTarget)) < cvxBalance;
    if (approveCvx) await cvx.approve(zrxCvxAllowanceTarget, constants.MaxUint256);

    const cvxToWethTx: Tx = {
      to: this.zrxContractAddress,
      data: zrxCvxData,
    };
    await multicallSwapperSigner.sendTransaction(cvxToWethTx);

    console.log('[CurveSpellEth] Convert weth to eth');
    const wethBalance = await weth.balanceOf(this.multicallSwapperAddress);
    await weth.withdraw(wethBalance);

    console.log('[CurveSpellEth] Convert weth to crvSpellEth');
    await curveSwap.add_liquidity([wethBalance, 0], 0, true, this.strategyAddress, { value: wethBalance });

    // Create txs for multichain swapper
    const transactions: PopulatedTransaction[] = [];

    // zrx trades
    if (approveCrv) transactions.push(await crv.populateTransaction.approve(zrxCrvAllowanceTarget, constants.MaxUint256));
    transactions.push(crvToWethTx);
    if (approveCvx) transactions.push(await cvx.populateTransaction.approve(zrxCvxAllowanceTarget, constants.MaxUint256));
    transactions.push(cvxToWethTx);

    // Withdraw eth
    transactions.push(await weth.populateTransaction.withdraw(wethBalance));

    // eth -> crvSpellEth
    transactions.push(
      await curveSwap.populateTransaction.add_liquidity([wethBalance, 0], 0, true, this.strategyAddress, { value: wethBalance })
    );

    const data = mergeTransactions(transactions);
    console.log('[CurveSpellEth] Data after merging transactions:', data);

    const executeTx = await tradeFactory.populateTransaction['execute((address,address,address,uint256,uint256)[],address,bytes)'](
      [
        {
          _strategy: this.strategyAddress,
          _tokenIn: this.crvAddress,
          _tokenOut: this.crvSpellEthAddress,
          _amount: crvBalance,
          _minAmountOut: BigNumber.from('0'),
        },
        {
          _strategy: this.strategyAddress,
          _tokenIn: this.cvxAddress,
          _tokenOut: this.crvSpellEthAddress,
          _amount: cvxBalance,
          _minAmountOut: BigNumber.from('0'),
        },
      ],
      this.multicallSwapperAddress,
      data
    );

    return executeTx;
  }
}
