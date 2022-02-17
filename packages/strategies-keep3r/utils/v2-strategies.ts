import { e18 } from './web3-utils';

export const v2Strategies = [
  {
    name: 'StrategyCurve3CrvVoterProxy',
    // tend: {
    //   added: false,
    //   amount:0,
    // },
    harvest: {
      added: false,
      amount: 2_000_000,
    },
    address: '0xC59601F0CC49baa266891b7fc63d2D5FE097A79D',
    vault: '0x9cA85572E6A3EbF24dEDd195623F188735A5179f',
  },
  {
    name: 'Curve.fi Factory Crypto Pool: YFI/ETHConvex Strat',
    // tend: {
    //   added: false,
    //   amount:0,
    // },
    harvest: {
      added: true,
      amount: 2_000_000,
    },
    address: '0xa04947059831783C561e59A43B93dCB5bEE7cab2',
    vault: '0x790a60024bC3aea28385b60480f15a0771f26D09',
  },
];
