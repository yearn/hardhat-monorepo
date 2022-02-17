import _ from 'lodash';
import { utils, BigNumber, constants, PopulatedTransaction } from 'ethers';
import { ICurveFi__factory, IERC20__factory, IWETH__factory, TradeFactory } from '@typechained';
import zrx from '@libraries/dexes/zrx';
import { mergeTransactions } from '@scripts/libraries/utils/multicall';
import { impersonate } from '@test-utils/wallet';
import { SimpleEnabledTrade, Solver } from '@scripts/libraries/types';
import * as wallet from '@test-utils/wallet';
import { ethers } from 'hardhat';

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
    const multicallSwapperAddress = (await ethers.getContract('MultiCallOptimizedSwapper')).address;
    const strategySigner = await impersonate(this.strategyAddress);
    const multicallSwapperSigner = await impersonate(multicallSwapperAddress);
    const crvStrategy = IERC20__factory.connect(this.crvAddress, strategySigner);
    const cvxStrategy = IERC20__factory.connect(this.cvxAddress, strategySigner);
    const crv = IERC20__factory.connect(this.crvAddress, multicallSwapperSigner);
    const cvx = IERC20__factory.connect(this.cvxAddress, multicallSwapperSigner);
    const weth = IWETH__factory.connect(this.wethAddress, multicallSwapperSigner);
    const crvSpellEth = IERC20__factory.connect(this.crvSpellEthAddress, multicallSwapperSigner);
    const curveSwap = ICurveFi__factory.connect(this.curveSwapAddress, multicallSwapperSigner);

    const crvBalance = (await crv.balanceOf(strategy)).sub(1);
    console.log('[CurveYfiEth] Total CRV balance is', utils.formatEther(crvBalance));
    const cvxBalance = (await cvx.balanceOf(strategy)).sub(1);
    console.log('[CurveYfiEth] Total CVX balance is', utils.formatEther(cvxBalance));

    console.log('[CurveSpellEth] Transfering crv/cvx to multicall swapper for simulations');
    await crvStrategy.transfer(multicallSwapperAddress, crvBalance);
    await cvxStrategy.transfer(multicallSwapperAddress, cvxBalance);

    // Create txs for multichain swapper
    const transactions: PopulatedTransaction[] = [];

    console.log('[CurveSpellEth] Getting crv => weth trade information via zrx');
    const { data: zrxCvrData, allowanceTarget: zrxCrvAllowanceTarget } = await zrx.quote({
      chainId: 1,
      sellToken: crv.address,
      buyToken: weth.address,
      sellAmount: crvBalance,
      slippagePercentage: 10 / 100,
    });

    const approveCrv = (await crv.allowance(multicallSwapperAddress, zrxCrvAllowanceTarget)).lt(crvBalance);
    if (approveCrv) {
      console.log('[CurveSpellEth] Approving crv');
      const approveCrvTx = await crv.populateTransaction.approve(zrxCrvAllowanceTarget, constants.MaxUint256);
      await multicallSwapperSigner.sendTransaction(approveCrvTx);
      transactions.push(approveCrvTx);
    }

    console.log('[CurveSpellEth] Executing crv => weth via zrx');
    const crvToWethTx: Tx = {
      to: this.zrxContractAddress,
      data: zrxCvrData,
    };
    await multicallSwapperSigner.sendTransaction(crvToWethTx);
    transactions.push(crvToWethTx);

    console.log('[CurveSpellEth] Getting cvx => weth trade information via zrx');
    const { data: zrxCvxData, allowanceTarget: zrxCvxAllowanceTarget } = await zrx.quote({
      chainId: 1,
      sellToken: cvx.address,
      buyToken: weth.address,
      sellAmount: cvxBalance,
      slippagePercentage: 10 / 100,
    });

    const approveCvx = (await cvx.allowance(multicallSwapperAddress, zrxCvxAllowanceTarget)).lt(cvxBalance);
    if (approveCvx) {
      console.log('[CurveSpellEth] Approving cvx');
      const approveCvxTx = await cvx.populateTransaction.approve(zrxCvxAllowanceTarget, constants.MaxUint256);
      await multicallSwapperSigner.sendTransaction(approveCvxTx);
      transactions.push(approveCvxTx);
    }

    console.log('[CurveSpellEth] Executing cvx => weth via zrx');
    const cvxToWethTx: Tx = {
      to: this.zrxContractAddress,
      data: zrxCvxData,
    };
    await multicallSwapperSigner.sendTransaction(cvxToWethTx);
    transactions.push(cvxToWethTx);

    const wethBalance = await weth.balanceOf(multicallSwapperAddress);
    console.log('[CurveSpellEth] Total WETH balance is', utils.formatEther(wethBalance));

    const approveWeth = (await weth.allowance(multicallSwapperAddress, curveSwap.address)).lt(wethBalance);
    if (approveWeth) {
      console.log('[CurveSpellEth] Approving weth');
      const approveWethTx = await weth.populateTransaction.approve(curveSwap.address, constants.MaxUint256);
      await multicallSwapperSigner.sendTransaction(approveWethTx);
      transactions.push(approveWethTx);
    }

    console.log('[CurveSpellEth] Converting weth to crvSpellEth');
    const curveCalculatedTokenAmountOut = await curveSwap.calc_token_amount([wethBalance, 0]);
    const curveCalculatedTokenMinAmountOut = curveCalculatedTokenAmountOut.sub(curveCalculatedTokenAmountOut.mul(3).div(100)); // 3% slippage
    const addLiquidityTx = await curveSwap.populateTransaction.add_liquidity(
      [wethBalance, 0],
      curveCalculatedTokenMinAmountOut,
      false,
      this.strategyAddress
    );
    await multicallSwapperSigner.sendTransaction(addLiquidityTx);
    transactions.push(addLiquidityTx);

    const amountOut = await crvSpellEth.balanceOf(this.strategyAddress);
    console.log('[CurveSpellEth] Final crvSpellEth balance is', utils.formatEther(amountOut));

    if (amountOut.eq(0)) throw new Error('No crvSpellEth tokens were received');

    console.log('[CurveSpellEth] Min crvSPELLETH amount out will be', utils.formatEther(curveCalculatedTokenMinAmountOut));

    const data = mergeTransactions(transactions);

    const executeTx = await tradeFactory.populateTransaction['execute((address,address,address,uint256,uint256)[],address,bytes)'](
      [
        {
          _strategy: this.strategyAddress,
          _tokenIn: this.crvAddress,
          _tokenOut: this.crvSpellEthAddress,
          _amount: crvBalance,
          _minAmountOut: curveCalculatedTokenMinAmountOut,
        },
        {
          _strategy: this.strategyAddress,
          _tokenIn: this.cvxAddress,
          _tokenOut: this.crvSpellEthAddress,
          _amount: cvxBalance,
          _minAmountOut: curveCalculatedTokenMinAmountOut,
        },
      ],
      multicallSwapperAddress,
      data
    );

    return executeTx;
  }
}
