import { ethers } from 'hardhat';
import { ZrxLibrary } from '../dexes/zrx';
import { DexLibrary } from '../types';

const zrxLibrary = new ZrxLibrary({ name: 'ZrxLibrary', network: ethers.provider.network });

export type SUPPORTED_NETWORKS_MOCK = 'mainnet' | 'fantom';
export type MAINNET_DEXES = 'uniswap' | 'zrx';
export type FANTOM_DEXES = 'spookyswap' | 'zrx';

export type DexesNetworkMap = {
  mainnet: { [dexes in MAINNET_DEXES]: DexLibrary };
  fantom: { [dexes in FANTOM_DEXES]: DexLibrary };
};

export async function initDexesNetworkMap() {}

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
