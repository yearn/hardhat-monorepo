import { SolversMap, StrategyConfiguration } from '@libraries/types';
import Dexes from '@scripts/libraries/solvers/Dexes';
import { utils } from 'ethers';
import { BooSexSeller } from '../libraries/solvers/multicall/BooSexSeller';

export type FantomSolvers = 'BooSexSeller' | 'Dexes';

const fantomConfig: StrategyConfiguration<'FANTOM'> = {
  '0xADE3BaC94177295329474aAd6A253Bae979BFA68': { // old boo strat
    name: 'Some Boo strat',
    tradesConfigurations: [
      {
        enabledTrades: [
          {
            tokenIn: '0x888EF71766ca594DED1F0FA3AE64eD2941740A20', // SOLID
            tokenOut: '0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE', // BOO
            threshold: utils.parseEther('250'),
          },
        ],
        solver: 'Dexes',
      },
      {
        enabledTrades: [
          {
            tokenIn: '0xD31Fcd1f7Ba190dBc75354046F6024A9b86014d7', // SEX
            tokenOut: '0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE', // BOO
            threshold: utils.parseEther('250'),
          },
        ],
        solver: 'BooSexSeller',
      },
    ],
  },
  '0x768F43717899FD0f1B45Ea7f23b66e191348073E': { // new boo strat
    name: 'Some Boo strat',
    tradesConfigurations: [
      {
        enabledTrades: [
          {
            tokenIn: '0x888EF71766ca594DED1F0FA3AE64eD2941740A20', // SOLID
            tokenOut: '0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE', // BOO
            threshold: utils.parseEther('250'),
          },
        ],
        solver: 'Dexes',
      },
      {
        enabledTrades: [
          {
            tokenIn: '0xD31Fcd1f7Ba190dBc75354046F6024A9b86014d7', // SEX
            tokenOut: '0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE', // BOO
            threshold: utils.parseEther('250'),
          },
        ],
        solver: 'BooSexSeller',
      },
    ],
  },
};

const getFantomSolversMap = async (): Promise<SolversMap<'FANTOM'>> => {
  return {
    BooSexSeller: new BooSexSeller(),
    Dexes: new Dexes(),
  };
};

export { getFantomSolversMap, fantomConfig };
