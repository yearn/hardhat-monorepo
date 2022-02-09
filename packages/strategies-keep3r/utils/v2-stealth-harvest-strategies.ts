import { BigNumberish } from 'ethers';
import { e18, ZERO_ADDRESS } from './web3-utils';

export interface v2HarvestStealthStrategy {
  name: string;
  added: boolean;
  amount: BigNumberish;
  address: string;
  costToken?: string;
  costPair?: string;
}

export const v2StealthStrategies: v2HarvestStealthStrategy[] = [
  {
    name: 'StrategyIdleidleUSDCYield',
    added: true,
    amount: 2_800_000,
    address: '0x2E1ad896D3082C52A5AE7Af307131DE7a37a46a0',
  },
  {
    name: 'StrategyIdleidleUSDTYield',
    added: true,
    amount: 2_800_000,
    address: '0x01b54c320d6B3057377cbc71d953d1BBa84df44e',
  },
  /* ETH */
  {
    name: 'convex_ankr',
    added: true,
    address: '0xB194dCFF4E11d26919Ce3B3255F69aEca5951e88',
    amount: 2_000_000,
  },
  {
    name: 'convex_reth',
    added: true,
    address: '0x8E4AA2E00694Adaf37f0311651262671f4d7Ac16',
    amount: 2_000_000,
  },
  {
    name: 'convex_steth',
    added: true,
    address: '0x6C0496fC55Eb4089f1Cf91A4344a2D56fAcE51e3',
    amount: 2_000_000,
  },
  {
    name: 'convex_seth',
    added: true,
    address: '0x22D07F42Cf4D077E765560ff6A741eF8E851091c',
    amount: 2_000_000,
  },
  /* BTC */
  {
    name: 'convex_hbtc',
    added: true,
    address: '0x7Ed0d52C5944C7BF92feDC87FEC49D474ee133ce',
    amount: 2_000_000,
  },
  {
    name: 'convex_bbtc',
    added: true,
    address: '0xE9ac8D34C546CBfdAD98F9a4546Db5fE08D01bF2',
    amount: 2_000_000,
  },
  {
    name: 'convex_obtc',
    added: true,
    address: '0xDb2D3F149270630382D4E6B4dbCd47e665D78D76',
    amount: 2_000_000,
  },
  {
    name: 'convex_pbtc',
    added: true,
    address: '0x7b5cb4694b0A299ED2F65db7d87B286461549e84',
    amount: 2_000_000,
  },
  {
    name: 'convex_sbtc',
    added: true,
    address: '0x7aB4DB515bf258A88Bb14f3685769a0f70B8778f',
    amount: 2_000_000,
  },
  {
    name: 'convex_tbtc',
    added: true,
    address: '0x07fb6A53185E2F095253099A47F34CD410eB2A89',
    amount: 2_000_000,
  },
  {
    name: 'convex_renbtc',
    added: true,
    address: '0x7799F476522Ebe259fc525C1A21E84f7Dd551955',
    amount: 2_000_000,
  },
  /* STABLES */
  {
    name: 'convex_usdp',
    added: true,
    address: '0xfb0702469A1a0440E87C06605461E8660FD0F43d',
    amount: 2_000_000,
  },
  {
    name: 'convex_usdn',
    added: true,
    address: '0x8e87e65Cb28c069550012f92d5470dB6EB6897c0',
    amount: 2_000_000,
  },
  {
    name: 'convex_ybusd',
    added: true,
    address: '0x3cA0B4d7eedE71061B0bAdb4F0E86E99b0FEa613',
    amount: 2_000_000,
  },
  {
    name: 'convex_susd',
    added: true,
    address: '0xFA773b91b59B0895877c769000b9824b46b13a20',
    amount: 2_000_000,
  },
  {
    name: 'convex_3pool',
    added: true,
    address: '0xeC088B98e71Ba5FFAf520c2f6A6F0153f1bf494B',
    amount: 2_000_000,
  },
  {
    name: 'convex_yusd',
    added: true,
    address: '0xA5189cb0149761A8346D64E384924b2394dFa595',
    amount: 2_000_000,
  },
  {
    name: 'convex_gusd',
    added: true,
    address: '0x2D42CFdC6a1B03490892AdF7DC6c62AA7228E5D6',
    amount: 2_000_000,
  },
  {
    name: 'convex_dusd',
    added: true,
    address: '0x33d7E0Fa2c7Db85Ef3AbC1C44e07E0b5cB2E4C14',
    amount: 2_000_000,
  },
  {
    name: 'convex_aave',
    added: true,
    address: '0xAC4AE0B06C913dF4608dB60E2571a8e91b74C619',
    amount: 2_000_000,
  },
  {
    name: 'convex_saave',
    added: true,
    address: '0xF5636591256195414f25d19034B70A4742Fc2A2e',
    amount: 2_000_000,
  },
  {
    name: 'convex_lusd',
    added: true,
    address: '0xecFF3267626DEF1bE8AA58E525b72af295c78131',
    amount: 2_000_000,
  },
  {
    name: 'convex_frax',
    added: true,
    address: '0x5E1dCe90AB54382e3f66E0b245E07209798c171c',
    amount: 2_000_000,
  },
  {
    name: 'convex_busd',
    added: true,
    address: '0xA44F947e51Ec6456A1d786F82ea5865F87Da9C30',
    amount: 2_000_000,
  },
  {
    name: 'convex_rsv',
    added: true,
    address: '0xA7A5BFf106d5E7aA601F6D540c5034Ca2a13787B',
    amount: 2_000_000,
  },
  {
    name: 'convex_tusd',
    added: true,
    address: '0x270101459e9A38Db38Ba4Cb8718FfA31953A9Af3',
    amount: 2_000_000,
  },
  {
    name: 'convex_alusd',
    added: true,
    address: '0x02E158754e92c9ccDB5E61b42902EF6a4e008f48',
    amount: 2_000_000,
  },
  {
    name: 'convex_ironbank',
    added: true,
    address: '0xf0aAba6bb8E6bAE83Ea984BC4b7dcf0fF54a8FEF',
    amount: 2_000_000,
  },
  {
    name: 'convex_musd',
    added: true,
    address: '0x75be6ABC02a010559Ed5c7b0Eab94abD2B783b65',
    amount: 2_000_000,
  },
  {
    name: 'convex_compound',
    added: true,
    address: '0x2b0b941d98848d6c9C729d944E3B1BD9C00A5529',
    amount: 2_000_000,
  },
  {
    name: 'convex_link',
    added: true,
    address: '0xb7f013426d33fe27e4E8ABEE58500268554736bD',
    amount: 2_000_000,
  },
  {
    name: 'convex_eurs',
    added: true,
    address: '0xC45b3312c0DE684301a58A1eee558151BBE8f45c',
    amount: 2_000_000,
  },
  {
    name: 'convex_3crypto',
    added: true,
    address: '0x2055CFD5CDbc90c60A202A1AC3DDfB71AeC1cE98',
    amount: 2_000_000,
  },
  {
    name: 'convex_eurt',
    added: true,
    address: '0x5E10E27DEae12877e23A68cC0d6F1b134b4d517A',
    amount: 2_000_000,
  },
  {
    name: 'convex_mim',
    added: true,
    address: '0x6570B0a1593a59CcB378fb0b01A753875FCa99c4',
    amount: 2_000_000,
  },
  {
    name: 'StrategyKashiMultiPairLender',
    added: true,
    address: '0xC8f17f8E15900b6D6079680b15Da3cE5263f62AA',
    amount: 2_000_000,
  },
  {
    name: 'dai_lev_comp',
    added: true,
    address: '0x6341c289b2E0795A04223DF04B53A77970958723',
    amount: 2_000_000,
  },
  {
    name: 'usdc_lev_comp',
    added: true,
    address: '0xE6c78b85f93c25B8EE7d963fD15d1d53a00F5908',
    amount: 2_000_000,
  },
  {
    name: 'dai_router',
    added: true,
    address: '0x3D6532c589A11117a4494d9725bb8518C731f1Be',
    amount: 2_000_000,
  },
  {
    name: 'weth_router',
    added: true,
    address: '0xE5f7f2E59B259E11EcF2Ff76fDf5dC7438363A3f',
    amount: 2_000_000,
  },
  {
    name: 'StrategyKashiMultiPairLender - TUSD',
    added: true,
    address: '0x564bf2844654f149821697cC56572eE4384c05f7',
    amount: 2_000_000,
  },
  {
    name: 'Gen Lender USDT',
    added: true,
    address: '0x2f87c5e8396F0C41b86aad4F3C8358aB21681952',
    amount: 2_000_000,
  },
  {
    name: 'GenericAave - USDT plugin',
    added: true,
    address: '0x41b51b0b9ECDD0ee54D82798e83Fd3B9562A7A3c',
    amount: 2_000_000,
  },
  {
    name: 'DAI lev comp',
    added: true,
    address: '0x62EA2aCe7a7861394f4A38B84D119498DBBb022c',
    amount: 2_000_000,
  },
  {
    name: 'USDC lev comp',
    added: true,
    address: '0xC0176FAa0e20dFf3CB6B810aEaE64ef271B1b64b',
    amount: 2_000_000,
  },
  {
    name: 'WBTC lev comp',
    added: true,
    address: '0x619Dde92f9fD8Af679025A2fD7e9ED2269e4c0c8',
    amount: 2_000_000,
  },
];
