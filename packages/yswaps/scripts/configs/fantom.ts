import { SolversMap, StrategyConfiguration } from '@libraries/types';
import Dexes from '@scripts/libraries/solvers/Dexes';
import { Boo } from '@scripts/libraries/solvers/multicall/Boo';

export type FantomSolvers = 'Boo' | 'Dexes';

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
    ],
  },
};

const getFantomSolversMap = async (): Promise<SolversMap<'FANTOM'>> => {
  return {
    Boo: new Boo(),
    Dexes: new Dexes(),
  };
};

export { getFantomSolversMap, fantomConfig };
