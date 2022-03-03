import { SolversMap, StrategyConfiguration } from '@libraries/types';
import Dexes from '@scripts/libraries/solvers/Dexes';
import { Boo } from '@scripts/libraries/solvers/multicall/Boo';
import { BooSexSeller } from '../libraries/solvers/multicall/BooSexSeller';

export type FantomSolvers = 'Boo' | 'BooSexSeller' | 'Dexes';

const fantomConfig: StrategyConfiguration<'FANTOM'> = {
  '0xADE3BaC94177295329474aAd6A253Bae979BFA68': {
    name: 'Some Boo strat',
    tradesConfigurations: [
      {
        enabledTrades: [
          {
            tokenIn: '0x888EF71766ca594DED1F0FA3AE64eD2941740A20', // SOLID
            tokenOut: '0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE', // BOO
          },
        ],
        solver: 'Boo',
      },
      // {
      //   enabledTrades: [
      //     {
      //       tokenIn: '0xD31Fcd1f7Ba190dBc75354046F6024A9b86014d7', // SEX
      //       tokenOut: '0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE', // BOO
      //     },
      //   ],
      //   solver: 'BooSexSeller',
      // },
    ],
  },
};

const getFantomSolversMap = async (): Promise<SolversMap<'FANTOM'>> => {
  return {
    Boo: new Boo(),
    BooSexSeller: new BooSexSeller(),
    Dexes: new Dexes(),
  };
};

export { getFantomSolversMap, fantomConfig };
