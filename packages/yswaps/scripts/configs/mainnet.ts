import { SolversMap, StrategyConfiguration } from '@libraries/types';
import Dexes from '@scripts/libraries/solvers/Dexes';
import MulticallDexes from '@scripts/libraries/solvers/Dexes';
import { ThreePoolCrv } from '@scripts/libraries/solvers/multicall/ThreePoolCrv';
import { utils } from 'ethers';

export type MainnetSolvers = 'ThreePoolCrv' | 'Dexes' | 'MulticallDexes';

const mainnetConfig: StrategyConfiguration<'MAINNET'> = {
  // '0x91C3424A608439FBf3A91B6d954aF0577C1B9B8A': {
  //   name: 'Strategy that uses 3poolCRV Solver',
  //   tradesConfigurations: [
  //     {
  //       enabledTrade:
  //         {
  //           tokenIn: '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490', // 3Crv
  //           tokenOut: '0x9d409a0A012CFbA9B15F6D4B36Ac57A46966Ab9a', // yvBoost
  //           threshold: utils.parseUnits('40000', 18),
  //         },
  //       solver: 'ThreePoolCrv',
  // metadata: { hopTokens: [] }
  //     },
  //   ],
  // },
  // '0xeDB4B647524FC2B9985019190551b197c6AB6C5c': {
  //   name: 'Strategy that uses crvSpellEth Solver',
  //   tradesConfigurations: [
  //     {
  //       enabledTrade:
  //         {
  //           tokenIn: '0xD533a949740bb3306d119CC777fa900bA034cd52', // CRV
  //           tokenOut: '0x8282BD15dcA2EA2bDf24163E8f2781B30C43A2ef', // crvSpellEth
  //           threshold: utils.parseUnits('20000', 18),
  //         },
  //       solver: 'MulticallDexes',
  // metadata: { hopTokens: [] }
  //     },
  //     {
  //       enabledTrade:
  //         {
  //           tokenIn: '0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B', // CVX
  //           tokenOut: '0x8282BD15dcA2EA2bDf24163E8f2781B30C43A2ef', // crvSpellEth
  //           threshold: utils.parseUnits('2500', 18),
  //         },
  //       solver: 'MulticallDexes',
  // metadata: { hopTokens: [] }
  //     },
  //   ],
  // },
  '0xa04947059831783C561e59A43B93dCB5bEE7cab2': {
    name: 'Strategy that uses crvYfiEth Solver',
    tradesConfigurations: [
      {
        enabledTrade: {
          tokenIn: '0xD533a949740bb3306d119CC777fa900bA034cd52', // CRV
          tokenOut: '0x29059568bB40344487d62f7450E78b8E6C74e0e5', // crvYfiEth
          threshold: utils.parseUnits('20000', 18),
        },
        solver: 'MulticallDexes',
        metadata: { hopTokens: [] },
      },
      {
        enabledTrade: {
          tokenIn: '0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B', // CVX
          tokenOut: '0x29059568bB40344487d62f7450E78b8E6C74e0e5', // crvYfiEth
          threshold: utils.parseUnits('2500', 18),
        },
        solver: 'MulticallDexes',
        metadata: { hopTokens: [] },
      },
    ],
  },
  '0x2EFB43C8C9AFe71d98B3093C3FD4dEB7Ce543C6D': {
    name: 'Tokemak strategy',
    tradesConfigurations: [
      {
        enabledTrade: {
          tokenIn: '0x2e9d63788249371f1dfc918a52f8d799f4a38c94', // TOKE
          tokenOut: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
          threshold: utils.parseUnits('1600', 18),
        },
        solver: 'Dexes',
        metadata: { hopTokens: [] },
      },
    ],
  },
};

const getMainnetSolversMap = async (): Promise<SolversMap<'MAINNET'>> => {
  return {
    ThreePoolCrv: new ThreePoolCrv(),
    Dexes: new Dexes(),
    MulticallDexes: new MulticallDexes(),
  };
};

export { getMainnetSolversMap, mainnetConfig };
