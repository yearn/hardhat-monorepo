import { SolversMap, StrategyConfiguration } from '@libraries/types';
import Dexes from '@scripts/libraries/solvers/Dexes';
import MulticallDexes from '../libraries/solvers/MulticallDexes';
import { utils } from 'ethers';

export type FantomSolvers = 'Dexes' | 'MulticallDexes';

const fantomConfig: StrategyConfiguration<'FANTOM'> = {
  '0x768F43717899FD0f1B45Ea7f23b66e191348073E': {
    // new boo strat
    name: 'Some Boo strat',
    tradesConfigurations: [
      {
        enabledTrade: {
          tokenIn: '0x888EF71766ca594DED1F0FA3AE64eD2941740A20', // SOLID
          tokenOut: '0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE', // BOO
          threshold: utils.parseUnits('250', 18),
        },
        solver: 'MulticallDexes',
        metadata: { hopTokens: [] },
      },
      {
        enabledTrade: {
          tokenIn: '0xD31Fcd1f7Ba190dBc75354046F6024A9b86014d7', // SEX
          tokenOut: '0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE', // BOO
          threshold: utils.parseUnits('250', 18),
        },
        solver: 'MulticallDexes',
        metadata: { hopTokens: [] },
      },
    ],
  },
  '0xBa2251912D29Cb608953808dCBFAc6D0F7f580FF': {
    name: 'Wftm Anyftm veLp Solidex to Wftm',
    tradesConfigurations: [
      {
        enabledTrade: {
          tokenIn: '0x888EF71766ca594DED1F0FA3AE64eD2941740A20', // SOLID
          tokenOut: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83', // WFTM
          threshold: utils.parseUnits('250', 18),
        },
        solver: 'MulticallDexes',
        metadata: { hopTokens: [] },
      },
      {
        enabledTrade: {
          tokenIn: '0xD31Fcd1f7Ba190dBc75354046F6024A9b86014d7', // SEX
          tokenOut: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83', // WFTM
          threshold: utils.parseUnits('250', 18),
        },
        solver: 'MulticallDexes',
        metadata: { hopTokens: [] },
      },
    ],
  },
  // we need to make the refactor first before being able to swap this strat propertly.
  // '0x526f9FcD4db76878B62a450F1BD79cF38f036cc1': {
  //   name: 'Wftm Anyftm veLp Solidex to Yfi',
  //   tradesConfigurations: [
  //     {
  //       enabledTrades: [
  //         {
  //           tokenIn: '0x888EF71766ca594DED1F0FA3AE64eD2941740A20', // SOLID
  //           tokenOut: '0x29b0Da86e484E1C0029B56e817912d778aC0EC69', // YFI
  //           threshold: utils.parseUnits('250', 18),
  //         },
  //       ],
  //       solver: 'MulticallDexes',
  //     },
  //     {
  //       enabledTrades: [
  //         {
  //           tokenIn: '0xD31Fcd1f7Ba190dBc75354046F6024A9b86014d7', // SEX
  //           tokenOut: '0x29b0Da86e484E1C0029B56e817912d778aC0EC69', // YFI
  //           threshold: utils.parseUnits('250', 18),
  //         },
  //       ],
  //       solver: 'MulticallDexes',
  //     },
  //   ],
  // },
};

const getFantomSolversMap = async (): Promise<SolversMap<'FANTOM'>> => {
  return {
    Dexes: new Dexes(),
    MulticallDexes: new MulticallDexes(),
  };
};

export { getFantomSolversMap, fantomConfig };
