import { BigNumber, PopulatedTransaction } from 'ethers';
import { TradeFactory } from '@typechained';
import { MainnetSolvers } from '../configs/mainnet';
import { FantomSolvers } from '@scripts/configs/fantom';

export type DexLibrarySwapProps = {
  tokenIn: string;
  tokenOut: string;
  amountIn: BigNumber;
  hops?: string[];
};

export type DexLibrarySwapResponse = {
  data: string;
  swapTransactionData: string;
  amountOut: BigNumber;
  path: string[];
};

export abstract class DexLibrary {
  abstract swap(props: DexLibrarySwapProps): Promise<DexLibrarySwapResponse>;
}

export class BaseDexLibrary {
  protected _name: string;
  protected _network: Network;

  constructor({ name, network }: { name: string; network: Network }) {
    this._name = name;
    this._network = network;
  }
  public static async init({ name, network }: { name: string; network: Network }): Promise<BaseDexLibrary> {
    const dexLibraryInstance = new BaseDexLibrary({ name, network });
    await dexLibraryInstance._loadContracts();
    return dexLibraryInstance;
  }
  protected async _loadContracts(): Promise<void> {}
}

export abstract class Solver {
  abstract solve({
    strategy,
    trade,
    tradeFactory,
  }: {
    strategy: string;
    trade: SimpleEnabledTrade;
    tradeFactory: TradeFactory;
  }): Promise<PopulatedTransaction>;

  abstract shouldExecuteTrade({ strategy, trade }: { strategy: string; trade: SimpleEnabledTrade }): Promise<boolean>;
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
type Solvers = SolversNetworksMap[keyof SolversNetworksMap];

// TODO: move to solver
type DexesSolverMetadata = {
  hopTokens: string[]
}

// TODO: move to solver
type MultiDexesSolverMetadata = {
  hopTokens: string[];
};

// TODO: enforce that only accepts valid dexes keys from Solvers type
type SolversMetadataMap = {
  Dexes: DexesSolverMetadata;
  BooSexSeller: MultiDexesSolverMetadata;
  BooSolidSeller: MultiDexesSolverMetadata;
  CurveSpellEth: MultiDexesSolverMetadata;
  CurveYfiEth: MultiDexesSolverMetadata;
  SolidlySolver: MultiDexesSolverMetadata;
  ThreePoolCrv: MultiDexesSolverMetadata;
};


type TradeConfiguration<T extends Network> = { [K in SolversNetworksMap[T]]: {
    enabledTrade: SimpleEnabledTrade;
    solver: K;
    metadata: SolversMetadataMap[K]
} }[SolversNetworksMap[T]];


export type StrategyConfiguration<T extends Network> = {
  [strategy: string]: {
    name: string;
    tradesConfigurations: TradeConfiguration<T>[];
  };
};
