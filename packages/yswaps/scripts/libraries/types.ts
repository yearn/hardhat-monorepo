import { BigNumber, PopulatedTransaction } from 'ethers';
import { TradeFactory } from '@typechained';
import { MainnetSolvers } from '../configs/mainnet';
import { FantomSolvers } from '@scripts/configs/fantom';
import { Network as EthersNetwork } from '@ethersproject/networks';
import { DexesSolverMetadata } from './solvers/Dexes';
import { MultiDexesSolverMetadata } from './solvers/MulticallDexes';

export type DexLibrarySwapProps = {
  tokenIn: string;
  tokenOut: string;
  amountIn: BigNumber;
  strategy: string;
  hops?: string[];
};

export type DexLibrarySwapResponse = {
  dex: string;
  unsignedSwapTx: PopulatedTransaction;
  swapperData: string;
  swapperAddress: string;
  amountOut: BigNumber;
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
    trade,
    metadata,
    tradeFactory,
  }: {
    strategy: string;
    trade: SimpleEnabledTrade;
    metadata: SolversMetadataMap[keyof SolversMetadataMap];
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
export type Solvers = SolversNetworksMap[keyof SolversNetworksMap];

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

type TradeConfiguration<T extends Network> = {
  [K in SolversNetworksMap[T]]: {
    enabledTrade: SimpleEnabledTrade;
    solver: K;
    metadata: SolversMetadataMap[K];
  };
}[SolversNetworksMap[T]];

export type StrategyConfiguration<T extends Network> = {
  [strategy: string]: {
    name: string;
    tradesConfigurations: TradeConfiguration<T>[];
  };
};
