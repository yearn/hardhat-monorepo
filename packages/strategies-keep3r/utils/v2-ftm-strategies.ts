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
  {
    name: '0xDAO_WFTM',
    added: true,
    address: '0x585D4024C6aB31b67Dfd1624F2cA01Eb1dBe8D22',
  },
  {
    name: '0xDAO_WETH',
    added: true,
    address: '0xcF37B4a55f06dDA65591B1AF56812c5bb7E6d336',
  },
  {
    name: '0xDAO_WBTC',
    added: true,
    address: '0x71304d618bd2F1334d25F3aC836a2BA94A0622Ae',
  },
  {
    name: '0xDAO_USDC',
    added: true,
    address: '0x177E745771494F1FF8Ed3FCDcdfF02213A1AD761',
  },
  {
    name: '0xDAO_DAI',
    added: true,
    address: '0x44E0403e7Ee547F522BbBA5f49fd04a432d2ad82',
  },
  {
    name: '0xDAO_MIM',
    added: true,
    address: '0x76e32c811Cad5b835B780461efd202D561723D14',
  },
  {
    name: 'StrategyLenderYieldOptimiser_FTM',
    added: true,
    address: '0x695A4a6e5888934828Cb97A3a7ADbfc71A70922D',
  },
  {
    name: 'StrategyLenderYieldOptimiser_MIM',
    added: true,
    address: '0xD0D1f041F93c0fF1091457618E529610C67A76de',
  },
  {
    name: 'GenLevCompV3NoFlash_FTM',
    added: true,
    address: '0x935601c5694f23491921c14aA235c65c2ea2c4DE',
  },
  {
    name: 'StrategyMPH_FTM',
    added: true,
    address: '0xC395e256BDf89F2e9189dc67c9215e1949A22562',
  },
  {
    name: 'VeDaoMasterChef_ETH',
    added: true,
    address: '0x15045FC686d1E597D5bb6390d33CEA99C809C9A3',
  },
  {
    name: 'SingleSidedBeethoven_USDC',
    added: true,
    address: '0xfa9A5C7C27030602F1C03f7377553D1e694e1615',
  },
  {
    name: 'GenLevCompV3NoFlash_LINK',
    added: true,
    address: '0x1e0F7D116ffB998EeC879B96698222D1Ee8d87CB',
  },
  {
    name: 'VeDaoMasterChef_YFI',
    added: true,
    address: '0x6a59081C7d5ac3e82c58D5f595ed25D55E71EBDa',
  },
  {
    name: 'VeDaoMasterChef_MIM',
    added: true,
    address: '0x235750AF5Fdb77cA827c2ee0Ab469188bC877cC6',
  },
  {
    name: 'VeDaoMasterChef_FRAX',
    added: true,
    address: '0xcc94F866717093Bd60b9a58AD9ca343b1438c865',
  },
  {
    name: 'VeDaoMasterChef_USDC',
    added: true,
    address: '0xff0bCcA5848a063D3D23aC9d534CE4F5A8286BeE',
  },
  {
    name: 'VeDaoMasterChef_FTM',
    added: true,
    address: '0x3f4100F690a435b63Ad5e27B7d0d2587128B12fe',
  },
];

export const v2FtmTendStrategies: v2FtmStrategy[] = [
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
