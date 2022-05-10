import { BigNumber } from 'ethers';

export interface StrategyConfiguration {
  name: string;
  added: boolean;
  address: string;
  costToken?: string;
  costPair?: string;
}

export interface HarvestConfiguration extends StrategyConfiguration {
  tokensBeingDumped: string[];
  want: string;
  requiredAmounts?: BigNumber;
}

export const harvestConfigurations: HarvestConfiguration[] = [
  // { // TEST Entry, remove when a real one is added
  //   name: 'USDC GenLender',
  //   added: true,
  //   address: '0x27a5ce447f4E581aE69061E90521da4B5b298818',
  //   tokensBeingDumped: ['0xe0654C8e6fd4D733349ac7E09f6f23DA256bF475'],
  //   want: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
  // },
];

export const tendConfigurations: StrategyConfiguration[] = [];
