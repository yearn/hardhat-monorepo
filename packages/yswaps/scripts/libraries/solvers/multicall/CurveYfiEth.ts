import { BigNumber, constants, PopulatedTransaction, Signer, utils } from 'ethers';
import { ICurveFi, ICurveFi__factory, IERC20, IERC20__factory, IWETH, IWETH__factory, TradeFactory } from '@typechained';
import zrx from '@libraries/dexes/zrx';
import { mergeTransactions } from '@scripts/libraries/utils/multicall';
import { impersonate } from '@test-utils/wallet';
import { SimpleEnabledTrade, Solver } from '@scripts/libraries/types';
import { ethers } from 'hardhat';

const DUST_THRESHOLD = utils.parseEther('1');

// 1) crv => weth with zrx
// 2) cvx => weth with zrx
// 3) weth => eth with wrapper
// 4) eth => yfi/eth with curve

export class CurveYfiEth implements Solver {
  private strategyAddress = '0xa04947059831783C561e59A43B93dCB5bEE7cab2';
  private zrxContractAddress = '0xDef1C0ded9bec7F1a1670819833240f027b25EfF';

  private _crvYfiEth!: IERC20;
  private _crvSwap!: ICurveFi;
  private _cvx!: IERC20;
  private _crv!: IERC20;
  private _weth!: IWETH;

  public static async init(): Promise<CurveYfiEth> {
    const solverInstance = new CurveYfiEth();
    await solverInstance.loadContracts();
    return solverInstance;
  }

  private async loadContracts(): Promise<void> {
    this._crvYfiEth = await ethers.getContractAt<IERC20>(IERC20__factory.abi, '0x29059568bB40344487d62f7450E78b8E6C74e0e5');
    this._cvx = await ethers.getContractAt<IERC20>(IERC20__factory.abi, '0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B');
    this._crv = await ethers.getContractAt<IERC20>(IERC20__factory.abi, '0xD533a949740bb3306d119CC777fa900bA034cd52');
    this._weth = await ethers.getContractAt<IWETH>(IWETH__factory.abi, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2');
    this._crvSwap = await ethers.getContractAt<ICurveFi>(ICurveFi__factory.abi, '0xC26b89A667578ec7b3f11b2F98d6Fd15C07C54ba');
  }

  async shouldExecuteTrade({ strategy, trades }: { strategy: string; trades: SimpleEnabledTrade[] }): Promise<boolean> {
    const crvStrategyBalance = await this._crv.balanceOf(strategy);
    const cvxStrategyBalance = await this._cvx.balanceOf(strategy);
    return cvxStrategyBalance.gt(DUST_THRESHOLD) && crvStrategyBalance.gt(DUST_THRESHOLD);
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

    const crvBalance = (await this._crv.balanceOf(strategy)).sub(1);
    console.log('[CurveYfiEth] Total CRV balance is', utils.formatEther(crvBalance));
    const cvxBalance = (await this._cvx.balanceOf(strategy)).sub(1);
    console.log('[CurveYfiEth] Total CVX balance is', utils.formatEther(cvxBalance));

    console.log('[CurveYfiEth] Transfering crv/cvx to multicall swapper for simulations');
    await this._crv.connect(strategySigner).transfer(multicallSwapperAddress, crvBalance);
    await this._cvx.connect(strategySigner).transfer(multicallSwapperAddress, cvxBalance);

    // Create txs for multichain swapper
    const transactions: PopulatedTransaction[] = [];

    // Do gas optimizations
    console.log('[CurveYfiEth] Getting crv => weth trade information via zrx');
    const { data: zrxCrvData, allowanceTarget: zrxCrvAllowanceTarget } = await zrx.quote({
      chainId: 1,
      sellToken: this._crv.address,
      buyToken: this._weth.address,
      sellAmount: crvBalance,
      slippagePercentage: 10 / 100,
    });

    const approveCrv = (await this._crv.allowance(multicallSwapperAddress, zrxCrvAllowanceTarget)).lt(crvBalance);
    if (approveCrv) {
      console.log('[CurveYfiEth] Approving crv');
      const approveCrvTx = await this._crv.populateTransaction.approve(zrxCrvAllowanceTarget, constants.MaxUint256);
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
      sellToken: this._cvx.address,
      buyToken: this._weth.address,
      sellAmount: cvxBalance,
      slippagePercentage: 10 / 100,
    });

    const approveCvx = (await this._cvx.allowance(multicallSwapperAddress, zrxCvxAllowanceTarget)).lt(cvxBalance);
    if (approveCvx) {
      console.log('[CurveYfiEth] Approving cvx');
      const approveCvxTx = await this._cvx.populateTransaction.approve(zrxCvxAllowanceTarget, constants.MaxUint256);
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

    const wethBalance = await this._weth.balanceOf(multicallSwapperAddress);
    console.log('[CurveYfiEth] Total WETH balance is', utils.formatEther(wethBalance));

    const approveWeth = (await this._weth.allowance(multicallSwapperAddress, this._crvSwap.address)).lt(wethBalance);
    if (approveWeth) {
      console.log('[CurveYfiEth] Approving weth');
      const approveWethTx = await this._weth.populateTransaction.approve(this._crvSwap.address, constants.MaxUint256);
      await multicallSwapperSigner.sendTransaction(approveWethTx);
      transactions.push(approveWethTx);
    }

    console.log('[CurveYfiEth] Converting weth to crvYfiEth');
    const curveCalculatedTokenAmountOut = await this._crvSwap.calc_token_amount([wethBalance, 0]);
    const curveCalculatedTokenMinAmountOut = curveCalculatedTokenAmountOut.sub(curveCalculatedTokenAmountOut.mul(3).div(100)); // 3% slippage
    const addLiquidityTx = await this._crvSwap.populateTransaction.add_liquidity(
      [wethBalance, 0],
      curveCalculatedTokenMinAmountOut,
      false,
      this.strategyAddress
    );
    await multicallSwapperSigner.sendTransaction(addLiquidityTx);
    transactions.push(addLiquidityTx);

    const amountOut = await this._crvYfiEth.balanceOf(this.strategyAddress);
    console.log('[CurveYfiEth] Final crvYFIETH balance is', utils.formatEther(amountOut));

    if (amountOut.eq(0)) throw new Error('No crvYfiEth tokens were received');

    console.log('[CurveYfiEth] Min crvYFIETH amount out will be', utils.formatEther(curveCalculatedTokenMinAmountOut));

    const data = mergeTransactions(transactions);

    const executeTx = await tradeFactory.populateTransaction['execute((address,address,address,uint256,uint256)[],address,bytes)'](
      [
        {
          _strategy: this.strategyAddress,
          _tokenIn: this._crv.address,
          _tokenOut: this._crvYfiEth.address,
          _amount: crvBalance,
          _minAmountOut: curveCalculatedTokenMinAmountOut,
        },
        {
          _strategy: this.strategyAddress,
          _tokenIn: this._cvx.address,
          _tokenOut: this._crvYfiEth.address,
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
