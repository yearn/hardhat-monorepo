import { SolversMap, StrategyConfiguration } from '@libraries/types';
import Dexes from '@scripts/libraries/solvers/Dexes';
import { CurveSpellEth } from '@scripts/libraries/solvers/multicall/CurveSpellEth';
import { ThreePoolCrv } from '@scripts/libraries/solvers/multicall/ThreePoolCrv';

const solvers: SolversMap = {
  CurveSpellEth: new CurveSpellEth(),
  ThreePoolCrv: new ThreePoolCrv(),
  Dexes: new Dexes(),
};

const config: StrategyConfiguration = {
  '0x91C3424A608439FBf3A91B6d954aF0577C1B9B8A': {
    name: 'Strategy that uses 3poolCRV Solver',
    tradesConfigurations: [
      {
        enabledTrades: [
          {
            tokenIn: '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490', // 3Crv
            tokenOut: '0x9d409a0A012CFbA9B15F6D4B36Ac57A46966Ab9a', // yvBoost
          },
        ],
        solver: 'ThreePoolCrv',
      },
    ],
  },
  '0xeDB4B647524FC2B9985019190551b197c6AB6C5c': {
    name: 'Strategy that uses crvSpellEth Solver',
    tradesConfigurations: [
      {
        enabledTrades: [
          {
            tokenIn: '0xD533a949740bb3306d119CC777fa900bA034cd52', // CRV
            tokenOut: '0x8282BD15dcA2EA2bDf24163E8f2781B30C43A2ef', // crvSpellEth
          },
          {
            tokenIn: '0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B', // CVX
            tokenOut: '0x8282BD15dcA2EA2bDf24163E8f2781B30C43A2ef', // crvSpellEth
          },
        ],
        solver: 'CurveSpellEth',
      },
    ],
  },
};

export { config, solvers };
