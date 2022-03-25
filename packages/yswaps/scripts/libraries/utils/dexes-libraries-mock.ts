import { ethers } from 'hardhat';
import { ZrxLibrary } from '../dexes/zrx';
import { DexLibrary } from '../types';

const zrxLibrary = new ZrxLibrary({ name: 'ZrxLibrary', network: ethers.provider.network });

export type SUPPORTED_NETWORKS_MOCK = 'mainnet' | 'fantom';
export type MAINNET_DEXES = 'uniswap' | 'zrx';
export type FANTOM_DEXES = 'spookyswap' | 'zrx';

export interface DexesNetworkMap {
  mainnet: Record<MAINNET_DEXES, DexLibrary>,
  fantom: Record<FANTOM_DEXES, DexLibrary>,
}


export const dexesNerworkMapMock: DexesNetworkMap = {
  fantom: {
    spookyswap: zrxLibrary,
    zrx: zrxLibrary,
  },
  mainnet: {
    uniswap: zrxLibrary,
    zrx: zrxLibrary,
  },
};
