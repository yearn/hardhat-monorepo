import { BigNumber } from 'ethers';
import { ITradeFactoryPositionsHandler } from '@typechained';

export type TradeSetup = {
  swapper: string;
  swapperName: string;
  data: string;
  minAmountOut: BigNumber | undefined;
};

export type ExtendedEnabledTrade = ITradeFactoryPositionsHandler.EnabledTradeStruct & {
  _tokenIn: string | string[];
};
