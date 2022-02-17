import { BigNumber, constants, PopulatedTransaction, Signer, utils } from 'ethers';
import { ICurveFi, ICurveFi__factory, IERC20, IERC20__factory, IWETH, IWETH__factory, TradeFactory } from '@typechained';
import zrx from '@libraries/dexes/zrx';
import { mergeTransactions } from '@scripts/libraries/utils/multicall';
import { impersonate } from '@test-utils/wallet';
import { SimpleEnabledTrade, Solver } from '@scripts/libraries/types';
import * as wallet from '@test-utils/wallet';
import { ethers } from 'hardhat';

// 1) crv => weth with zrx
// 2) cvx => weth with zrx
// 3) weth => eth with wrapper
// 4) eth => yfi/eth with curve

export class CurveYfiEth implements Solver {
  private strategyAddress = '0xa04947059831783C561e59A43B93dCB5bEE7cab2';
  private curveSwapAddress = '0xC26b89A667578ec7b3f11b2F98d6Fd15C07C54ba';
  private crvAddress = '0xD533a949740bb3306d119CC777fa900bA034cd52';
  private cvxAddress = '0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B';
  private wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
  private zrxContractAddress = '0xDef1C0ded9bec7F1a1670819833240f027b25EfF';
  private crvYfiEthAddress = '0x29059568bB40344487d62f7450E78b8E6C74e0e5';

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
    const cvxStrategy = IERC20__factory.connect(this.cvxAddress, strategySigner); // Hack, there should be a better way
    const crv = IERC20__factory.connect(this.crvAddress, multicallSwapperSigner);
    const cvx = IERC20__factory.connect(this.cvxAddress, multicallSwapperSigner);
    const crvYfiEth = IERC20__factory.connect(this.crvYfiEthAddress, multicallSwapperSigner);
    const weth = IWETH__factory.connect(this.wethAddress, multicallSwapperSigner);
    const curveSwap = ICurveFi__factory.connect(this.curveSwapAddress, multicallSwapperSigner);

    const crvBalance = (await crv.balanceOf(strategy)).sub(1);
    console.log('[CurveYfiEth] Total CRV balance is', utils.formatEther(crvBalance));
    const cvxBalance = (await cvx.balanceOf(strategy)).sub(1);
    console.log('[CurveYfiEth] Total CVX balance is', utils.formatEther(cvxBalance));

    console.log('[CurveYfiEth] Transfering crv/cvx to multicall swapper for simulations');
    await crvStrategy.transfer(multicallSwapperAddress, crvBalance);
    await cvxStrategy.transfer(multicallSwapperAddress, cvxBalance);

    // Create txs for multichain swapper
    const transactions: PopulatedTransaction[] = [];

    // Do gas optimizations
    console.log('[CurveYfiEth] Getting crv => weth trade information via zrx');
    const { data: zrxCrvData, allowanceTarget: zrxCrvAllowanceTarget } = await zrx.quote({
      chainId: 1,
      sellToken: crv.address,
      buyToken: weth.address,
      sellAmount: crvBalance,
      slippagePercentage: 10 / 100,
    });

    const approveCrv = (await crv.allowance(multicallSwapperAddress, zrxCrvAllowanceTarget)).lt(crvBalance);
    if (approveCrv) {
      console.log('[CurveYfiEth] Approving crv');
      const approveCrvTx = await crv.populateTransaction.approve(zrxCrvAllowanceTarget, constants.MaxUint256);
      await multicallSwapperSigner.sendTransaction(approveCrvTx);
      transactions.push(approveCrvTx);
    }

    console.log('[CurveYfiEth] Executing crv => weth via zrx');
    const crvToWethTx = {
      to: this.zrxContractAddress,
      data: zrxCrvData,
    };
    await multicallSwapperSigner.sendTransaction(crvToWethTx);
    transactions.push(crvToWethTx);

    console.log('[CurveYfiEth] Getting cvx => weth trade information via zrx');
    const { data: zrxCvxData, allowanceTarget: zrxCvxAllowanceTarget } = await zrx.quote({
      chainId: 1,
      sellToken: cvx.address,
      buyToken: weth.address,
      sellAmount: cvxBalance,
      slippagePercentage: 10 / 100,
    });

    const approveCvx = (await cvx.allowance(multicallSwapperAddress, zrxCvxAllowanceTarget)).lt(cvxBalance);
    if (approveCvx) {
      console.log('[CurveYfiEth] Approving cvx');
      const approveCvxTx = await cvx.populateTransaction.approve(zrxCvxAllowanceTarget, constants.MaxUint256);
      await multicallSwapperSigner.sendTransaction(approveCvxTx);
      transactions.push(approveCvxTx);
    }

    console.log('[CurveYfiEth] Executing cvx => weth via zrx');
    const cvxToWethTx = {
      to: this.zrxContractAddress,
      data: zrxCvxData,
    };
    await multicallSwapperSigner.sendTransaction(cvxToWethTx);
    transactions.push(cvxToWethTx);

    const wethBalance = await weth.balanceOf(multicallSwapperAddress);
    console.log('[CurveYfiEth] Total WETH balance is', utils.formatEther(wethBalance));

    const approveWeth = (await weth.allowance(multicallSwapperAddress, curveSwap.address)).lt(wethBalance);
    if (approveWeth) {
      console.log('[CurveYfiEth] Approving weth');
      const approveWethTx = await weth.populateTransaction.approve(curveSwap.address, constants.MaxUint256);
      await multicallSwapperSigner.sendTransaction(approveWethTx);
      transactions.push(approveWethTx);
    }

    console.log('[CurveYfiEth] Converting weth to crvYfiEth');
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

    const amountOut = await crvYfiEth.balanceOf(this.strategyAddress);
    console.log('[CurveYfiEth] Final crvYFIETH balance is', utils.formatEther(amountOut));

    if (amountOut.eq(0)) throw new Error('No crvYfiEth tokens were received');

    console.log('[CurveYfiEth] Min crvYFIETH amount out will be', utils.formatEther(curveCalculatedTokenMinAmountOut));

    const data = mergeTransactions(transactions);

    const executeTx = await tradeFactory.populateTransaction['execute((address,address,address,uint256,uint256)[],address,bytes)'](
      [
        {
          _strategy: this.strategyAddress,
          _tokenIn: this.crvAddress,
          _tokenOut: this.crvYfiEthAddress,
          _amount: crvBalance,
          _minAmountOut: curveCalculatedTokenMinAmountOut,
        },
        {
          _strategy: this.strategyAddress,
          _tokenIn: this.cvxAddress,
          _tokenOut: this.crvYfiEthAddress,
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
