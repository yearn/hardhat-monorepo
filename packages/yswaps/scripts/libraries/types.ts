import { BigNumber, PopulatedTransaction } from 'ethers';
import { TradeFactory } from '@typechained';
import { MainnetSolvers } from '../configs/mainnet';
import { FantomSolvers } from '@scripts/configs/fantom';
import { Network as EthersNetwork } from '@ethersproject/networks';
import { DexesSolverMetadata } from './solvers/Dexes';
import { MultiDexesSolverMetadata } from './solvers/MulticallDexes';

export type DexName = string;
export type Address = string;

export type DexLibrarySwapProps = {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: BigNumber;
  strategy: Address;
  hops?: Address[];
};

export type DexLibrarySwapResponse = {
  dex: DexName;
  unsignedSwapTx: PopulatedTransaction;
  swapperData: string;
  swapperAddress: Address;
  amountOut: BigNumber;
  path: Address[];
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
    strategy: Address;
    trade: SimpleEnabledTrade;
    metadata: SolversMetadataMap[keyof SolversMetadataMap];
    tradeFactory: TradeFactory;
  }): Promise<PopulatedTransaction>;

  abstract shouldExecuteTrade({ strategy, trade }: { strategy: Address; trade: SimpleEnabledTrade }): Promise<boolean>;
}

export type SimpleEnabledTrade = {
  tokenIn: Address;
  tokenOut: Address;
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
  MulticallDexes: MultiDexesSolverMetadata;
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
  [strategy: Address]: {
    name: string;
    tradesConfigurations: TradeConfiguration<T>[];
  };
};
