import { BigNumber, PopulatedTransaction } from 'ethers';
import { TradeFactory } from '@typechained';
import { MainnetSolvers } from '../configs/mainnet';
import { FantomSolvers } from '@scripts/configs/fantom';
import { Network as EthersNetwork } from '@ethersproject/networks';

export type DexLibrarySwapProps = {
  tokenIn: string;
  tokenOut: string;
  amountIn: BigNumber;
  strategy: string;
  hops?: string[];
};

export type DexLibrarySwapResponse = {
  data: string;
  executionTransactionData: string;
  swapTransactionData: string;
  amountOut: BigNumber;
  dex: string;
  path: string[];
};

export abstract class DexLibrary {
  abstract swap(props: DexLibrarySwapProps): Promise<DexLibrarySwapResponse>;
}

export class BaseDexLibrary {
  protected _name: string;
  protected _network: EthersNetwork;

  constructor({ name, network }: { name: string; network: EthersNetwork }) {
    this._name = name;
    this._network = network;
  }
  public static async create({ name, network }: { name: string; network: EthersNetwork }): Promise<BaseDexLibrary> {
    const dexLibraryInstance = new BaseDexLibrary({ name, network });
    await dexLibraryInstance.init();
    return dexLibraryInstance;
  }
  protected async init(): Promise<void> {}
}

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
  threshold: BigNumber;
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
