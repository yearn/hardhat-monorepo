import { BigNumber, BigNumberish } from 'ethers';
import { e18, ZERO_ADDRESS } from './web3-utils';

export interface v2FtmStrategy {
  name: string;
  added: boolean;
  address: string;
  requiredAmounts?: BigNumber;
  costToken?: string;
  costPair?: string;
}

export const v2FtmHarvestStrategies: v2FtmStrategy[] = [
  {
    name: 'WFTM',
    added: true,
    address: '0x695a4a6e5888934828cb97a3a7adbfc71a70922d',
  },
  {
    name: 'MIM',
    added: true,
    address: '0xd0d1f041f93c0ff1091457618e529610c67a76de',
  },
  {
    name: 'USDC',
    added: true,
    address: '0x27a5ce447f4E581aE69061E90521da4B5b298818',
  },
  {
    name: 'DAI',
    added: true,
    address: '0xd025b85db175EF1b175Af223BD37f330dB277786',
  },
  {
    name: 'YFI',
    added: true,
    address: '0xDf262B43bea0ACd0dD5832cf2422e0c9b2C539dc',
  },
  {
    name: 'Curve Tricrypto',
    added: true,
    address: '0xcF3b91D83cD5FE15269E6461098fDa7d69138570',
  },
  {
    name: 'Curve Geist',
    added: true,
    address: '0x7ff6fe5bDa1b26fa46880dF8AF844326DAd50d13',
  },
  {
    name: 'FRAX GenLender',
    added: true,
    address: '0xfF8bb7261E4D51678cB403092Ae219bbEC52aa51',
  },
  {
    name: 'USDT GenLender',
    added: true,
    address: '0x83a5Af7540E919dE74cf2D6d5F40e47f11D3E8d1',
  },
  {
    name: 'levscream_dai',
    added: true,
    address: '0xdC9D3bB76Df8bE1e9Ca68C7BF32293a86C829D81',
  },
  {
    name: 'levscream_usdc',
    added: true,
    address: '0x42639b59cf9db5339C1C5cfB5738D0ba4F828F94',
  },
  {
    name: 'levscream_mim',
    added: true,
    address: '0x8A807b5742587024783Df3Ed2F149725C197b5eE',
  },
  {
    name: 'ssbeet_steadyBeetPool_dai',
    added: true,
    address: '0xE6b7D27157673aD2ae21AFD23CC35DA766105431',
  },
  {
    name: 'ssbeet_steadyBeetPool_usdc',
    added: true,
    address: '0xfa9A5C7C27030602F1C03f7377553D1e694e1615',
  },
  {
    name: 'ssbeet_staBeetPool_dai',
    added: true,
    address: '0xB905eabA7A23424265638bdACFFE55564c7B299B',
  },
  {
    name: 'ssbeet_staBeetPool_usdc',
    added: true,
    address: '0x56aF79e182a7f98ff6d0bF99d589ac2CabA24e2d',
  },
  {
    name: 'ssbeet_guqinQiPool_dai',
    added: true,
    address: '0x85c307D24da7086c41537b994de9bFc4C21BAEB5',
  },
  {
    name: 'ssbeet_guqinQiPool_usdc',
    added: true,
    address: '0xBd3791F3Dcf9DD5633cd30662381C80a2Cd945bd',
  },
  {
    name: 'ssbeet_beetXlpMimUsdcUsdtPool_mim',
    added: true,
    address: '0xbBdc83357287a29Aae30cCa520D4ed6C750a2a11',
  },
  {
    name: 'ssbeet_beetXlpMimUsdcUsdtPool_usdc',
    added: true,
    address: '0x4003eE222d44953B0C3eB61318dD211a4A6f109f',
  },
  {
    name: 'ssbeet_beetXlpMimUsdcUsdtPool_usdt',
    added: true,
    address: '0x36E74086C388305CEcdeff83d6cf31a2762A3c91',
  },
  {
    name: 'ssbeet_mimUsdcUstPool_usdc',
    added: true,
    address: '0x1c13C43f8F2fa0CdDEE6DFF6F785757650B8c2BF',
  },
  {
    name: 'ssbeet_mimUsdcUstPool_mim',
    added: true,
    address: '0xfD7E0cCc4dE0E3022F47834d7f0122274c37a0d1',
  },
  {
    name: 'ssbeet_asUsdcPool_usdc',
    added: true,
    address: '0x8Bb79E595E1a21d160Ba3f7f6C94efF1484FB4c9',
  },
  {
    name: 'levscream_weth',
    added: true,
    address: '0x9DF9418837281faC4C4c1166f55D35F2799A9107',
  },
  {
    name: 'levscream_wbtc',
    added: true,
    address: '0x0ed5C4effED69B39C86a8D806462d709Fb96A9E4',
  },
  {
    name: 'levscream_crv',
    added: true,
    address: '0x6EEb47BBcDf0059E5F1D6Ee844Ba793D5401bF18',
  },
  {
    name: 'levscream_spell',
    added: true,
    address: '0x35B51a621d78609dE7Cf25BC4e0682c7DEA38799',
  },
  {
    name: 'levscream_dola',
    added: true,
    address: '0x36A1E9dF5EfdAB9694de5bFe25A9ACc23F66BCB7',
  },
  {
    name: 'levscream_fusdt',
    added: true,
    address: '0x3B9bc1f596844Ca8a30A7710Aac7155968Db7d13',
  },
];

export const v2FtmTendStrategies: v2FtmStrategy[] = [
  {
    name: 'ssbeet_steadyBeetPool_dai',
    added: true,
    address: '0xE6b7D27157673aD2ae21AFD23CC35DA766105431',
  },
  {
    name: 'ssbeet_steadyBeetPool_usdc',
    added: true,
    address: '0xfa9A5C7C27030602F1C03f7377553D1e694e1615',
  },
  {
    name: 'ssbeet_staBeetPool_dai',
    added: true,
    address: '0xB905eabA7A23424265638bdACFFE55564c7B299B',
  },
  {
    name: 'ssbeet_staBeetPool_usdc',
    added: true,
    address: '0x56aF79e182a7f98ff6d0bF99d589ac2CabA24e2d',
  },
  {
    name: 'ssbeet_guqinQiPool_dai',
    added: true,
    address: '0x85c307D24da7086c41537b994de9bFc4C21BAEB5',
  },
  {
    name: 'ssbeet_guqinQiPool_usdc',
    added: true,
    address: '0xBd3791F3Dcf9DD5633cd30662381C80a2Cd945bd',
  },
  {
    name: 'ssbeet_beetXlpMimUsdcUsdtPool_usdc',
    added: true,
    address: '0x4003eE222d44953B0C3eB61318dD211a4A6f109f',
  },
  {
    name: 'ssbeet_beetXlpMimUsdcUsdtPool_usdt',
    added: true,
    address: '0x36E74086C388305CEcdeff83d6cf31a2762A3c91',
  },
  {
    name: 'ssbeet_mimUsdcUstPool_usdc',
    added: true,
    address: '0x1c13C43f8F2fa0CdDEE6DFF6F785757650B8c2BF',
  },
  {
    name: 'ssbeet_mimUsdcUstPool_mim',
    added: true,
    address: '0xfD7E0cCc4dE0E3022F47834d7f0122274c37a0d1',
  },
  {
    name: 'ssbeet_asUsdcPool_usdc',
    added: true,
    address: '0x8Bb79E595E1a21d160Ba3f7f6C94efF1484FB4c9',
  },
];
