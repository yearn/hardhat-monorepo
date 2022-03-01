import { PopulatedTransaction } from 'ethers';
import { TradeFactory } from '@typechained';
import { MainnetSolvers } from '../configs/mainnet';
import { FantomSolvers } from '@scripts/configs/fantom';

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

export type SimpleEnabledTrade = {
  tokenIn: string;
  tokenOut: string;
};

export type SolversMap<T extends Network> = {
  [solver in SolversNetworksMap[T]]: Solver;
};

export type SolversNetworksMap = {
  MAINNET: MainnetSolvers;
  FANTOM: FantomSolvers;
};

export type Network = keyof SolversNetworksMap;

export type TradeConfiguration<T extends Network> = {
  enabledTrades: SimpleEnabledTrade[];
  solver: SolversNetworksMap[T];
};

export type StrategyConfiguration<T extends Network> = {
  [strategy: string]: {
    name: string;
    tradesConfigurations: TradeConfiguration<T>[];
  };
};
