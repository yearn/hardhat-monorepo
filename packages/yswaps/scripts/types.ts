import { BigNumber } from 'ethers';

export type EnabledTrade = [string, string, string] & {
  _strategy: string;
  _tokenIn: string;
  _tokenOut: string;
};

// TODO Remove (deprecated)
export type PendingTrade = [BigNumber, string, string, string, BigNumber, BigNumber] & {
  _id: BigNumber;
  _strategy: string;
  _tokenIn: string;
  _tokenOut: string;
  _amountIn: BigNumber;
};

export type TradeSetup = {
  swapper: string;
  swapperName: string;
  data: string;
  minAmountOut: BigNumber | undefined;
};
