import { BigNumber, Signer } from 'ethers';
import { PendingTrade, TradeSetup } from '@scripts/types';
import { IMulticall } from './IMulticall';
import { ICurveFi, ICurveFi__factory, IERC20, IERC20__factory } from '@typechained';
import { network, ethers } from 'hardhat';
import { Router } from '@scripts/Router';

export class ThreePoolCrvMulticall implements IMulticall {
  match(trade: PendingTrade) {
    //if (trade._strategy == "0xYvBoost")
    return true;
  }

  async asyncSwap(trade: PendingTrade): Promise<TradeSetup> {
    const strategy: Signer = await ethers.getSigner(trade._strategy);
    const crv3Pool: ICurveFi = ICurveFi__factory.connect('0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7', strategy);
    const usdc: IERC20 = IERC20__factory.connect('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', strategy);

    await crv3Pool.remove_liquidity_one_coin(trade._amountIn, 1, 0);
    const usdcBalance: BigNumber = await usdc.balanceOf(await strategy.getAddress());

    // This doesn't work. I don't know why
    // const newPendingTrade: PendingTrade = {
    //     _id: trade._id,
    //     _strategy: trade._strategy,
    //     _tokenIn: usdc.address,
    //     _tokenOut: trade._tokenOut,
    //     _amountIn: usdcBalance,
    //     _deadline: trade._deadline
    // };

    trade._tokenIn = usdc.address;
    trade._amountIn = usdcBalance;
    let best: TradeSetup = await new Router().route(trade);

    console.log('best:', best);
    //await ethers.provider.send('hardhat_impersonateAccount', [personalAccMainnet]);
    // Perhaps we should use balance of swapper instead of trusting trade._amountIn

    return {
      swapper: '0x0-multichain',
      data: '0x0-data',
      minAmountOut: usdcBalance,
    };
  }
}
