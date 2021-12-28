import { BigNumber } from 'ethers';

export type PendingTrade = [BigNumber, string, string, string, BigNumber, BigNumber] & {
  _id: BigNumber;
  _strategy: string;
  _tokenIn: string;
  _tokenOut: string;
  _amountIn: BigNumber;
  _deadline: BigNumber;
};

export type TradeSetup = {
  swapper: string;
  swapperName: string;
  data: string;
  minAmountOut: BigNumber | undefined;
};
