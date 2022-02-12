import { PopulatedTransaction } from 'ethers';
import { TradeFactory } from '@typechained';

export abstract class Solver {
  abstract solve({
    strategy,
    trades,
    tradeFactory,
  }: {
    strategy: string;
    trades: SimpleEnabledTrade[];
    tradeFactory: TradeFactory;
  }): Promise<PopulatedTransaction>;

  abstract shouldExecuteTrade({ strategy, trades }: { strategy: string; trades: SimpleEnabledTrade[] }): Promise<boolean>;
}

export type Solvers = 'CurveSpellEth' | 'ThreePoolCrv' | 'Dexes';

export type SolversMap = {
  [solver in Solvers]?: Solver;
};

export type SimpleEnabledTrade = {
  tokenIn: string;
  tokenOut: string;
};

export type TradeConfiguration = {
  enabledTrades: SimpleEnabledTrade[];
  solver: Solvers;
};

export type StrategyConfiguration = {
  [strategy: string]: {
    name: string;
    tradesConfigurations: TradeConfiguration[];
  };
};
