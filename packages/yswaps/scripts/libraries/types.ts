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
  _amount: BigNumber | BigNumber[];
  _slippage?: number;
};

export interface IMulticallSolver extends Solver {
  match(trade: ExtendedEnabledTrade): boolean;
}

export abstract class Solver {
  abstract solve(trade: ExtendedEnabledTrade): Promise<TradeSetup>;
}
