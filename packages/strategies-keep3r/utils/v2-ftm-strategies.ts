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
  {
    name: 'USDC GenLender',
    added: true,
    address: '0x27a5ce447f4E581aE69061E90521da4B5b298818',
    tokensBeingDumped: ['0xe0654C8e6fd4D733349ac7E09f6f23DA256bF475'],
    want: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
  },
  {
    name: 'DAI GenLender',
    added: true,
    address: '0xd025b85db175EF1b175Af223BD37f330dB277786',
    tokensBeingDumped: ['0xe0654C8e6fd4D733349ac7E09f6f23DA256bF475'],
    want: '0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E',
  },
  {
    name: 'YFI GenLender',
    added: true,
    address: '0xDf262B43bea0ACd0dD5832cf2422e0c9b2C539dc',
    tokensBeingDumped: ['0xe0654C8e6fd4D733349ac7E09f6f23DA256bF475'],
    want: '0x29b0Da86e484E1C0029B56e817912d778aC0EC69',
  },
  {
    name: 'Curve Tricrypto',
    added: true,
    address: '0xcF3b91D83cD5FE15269E6461098fDa7d69138570',
    tokensBeingDumped: [],
    want: '0x58e57cA18B7A47112b877E31929798Cd3D703b0f',
  },
  {
    name: 'Curve Geist',
    added: true,
    address: '0x7ff6fe5bDa1b26fa46880dF8AF844326DAd50d13',
    tokensBeingDumped: [],
    want: '0xD02a30d33153877BC20e5721ee53DeDEE0422B2F',
  },
  {
    name: 'FRAX GenLender',
    added: true,
    address: '0xfF8bb7261E4D51678cB403092Ae219bbEC52aa51',
    tokensBeingDumped: ['0xe0654C8e6fd4D733349ac7E09f6f23DA256bF475'],
    want: '0xdc301622e621166BD8E82f2cA0A26c13Ad0BE355',
  },
  {
    name: 'USDT GenLender',
    added: true,
    address: '0x83a5Af7540E919dE74cf2D6d5F40e47f11D3E8d1',
    tokensBeingDumped: ['0xe0654C8e6fd4D733349ac7E09f6f23DA256bF475'],
    want: '0x049d68029688eAbF473097a2fC38ef61633A3C7A',
  },
  {
    name: 'levscream_dai',
    added: true,
    address: '0xdC9D3bB76Df8bE1e9Ca68C7BF32293a86C829D81',
    tokensBeingDumped: ['0xe0654C8e6fd4D733349ac7E09f6f23DA256bF475'],
    want: '0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E',
  },
  {
    name: 'levscream_usdc',
    added: true,
    address: '0x42639b59cf9db5339C1C5cfB5738D0ba4F828F94',
    tokensBeingDumped: ['0xe0654C8e6fd4D733349ac7E09f6f23DA256bF475'],
    want: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
  },
  {
    name: 'levscream_mim',
    added: true,
    address: '0x8A807b5742587024783Df3Ed2F149725C197b5eE',
    tokensBeingDumped: ['0xe0654C8e6fd4D733349ac7E09f6f23DA256bF475'],
    want: '0x82f0B8B456c1A451378467398982d4834b6829c1',
  },
  {
    name: 'levscream_weth',
    added: true,
    address: '0x9DF9418837281faC4C4c1166f55D35F2799A9107',
    tokensBeingDumped: ['0xe0654C8e6fd4D733349ac7E09f6f23DA256bF475'],
    want: '0x74b23882a30290451A17c44f4F05243b6b58C76d',
  },
  {
    name: 'levscream_wbtc',
    added: true,
    address: '0x0ed5C4effED69B39C86a8D806462d709Fb96A9E4',
    tokensBeingDumped: ['0xe0654C8e6fd4D733349ac7E09f6f23DA256bF475'],
    want: '0x321162Cd933E2Be498Cd2267a90534A804051b11',
  },
  {
    name: 'levscream_crv',
    added: true,
    address: '0x6EEb47BBcDf0059E5F1D6Ee844Ba793D5401bF18',
    tokensBeingDumped: ['0xe0654C8e6fd4D733349ac7E09f6f23DA256bF475'],
    want: '0x1E4F97b9f9F913c46F1632781732927B9019C68b',
  },
  {
    name: 'levscream_spell',
    added: true,
    address: '0x35B51a621d78609dE7Cf25BC4e0682c7DEA38799',
    tokensBeingDumped: ['0xe0654C8e6fd4D733349ac7E09f6f23DA256bF475'],
    want: '0x468003B688943977e6130F4F68F23aad939a1040',
  },
  {
    name: 'levscream_dola',
    added: true,
    address: '0x36A1E9dF5EfdAB9694de5bFe25A9ACc23F66BCB7',
    tokensBeingDumped: ['0xe0654C8e6fd4D733349ac7E09f6f23DA256bF475'],
    want: '0x3129662808bEC728a27Ab6a6b9AFd3cBacA8A43c',
  },
  {
    name: 'levscream_fusdt',
    added: true,
    address: '0x3B9bc1f596844Ca8a30A7710Aac7155968Db7d13',
    tokensBeingDumped: ['0xe0654C8e6fd4D733349ac7E09f6f23DA256bF475'],
    want: '0x049d68029688eAbF473097a2fC38ef61633A3C7A',
  },
  {
    name: 'WFTM GenLender',
    added: true,
    address: '0x695A4a6e5888934828Cb97A3a7ADbfc71A70922D',
    tokensBeingDumped: ['0xe0654C8e6fd4D733349ac7E09f6f23DA256bF475'],
    want: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
  },
  {
    name: 'MIM GenLender',
    added: true,
    address: '0xD0D1f041F93c0fF1091457618E529610C67A76de',
    tokensBeingDumped: ['0xe0654C8e6fd4D733349ac7E09f6f23DA256bF475'],
    want: '0x82f0B8B456c1A451378467398982d4834b6829c1',
  },
  {
    name: 'levscream_wftm',
    added: true,
    address: '0x935601c5694f23491921c14aA235c65c2ea2c4DE',
    tokensBeingDumped: ['0xe0654C8e6fd4D733349ac7E09f6f23DA256bF475'],
    want: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
  },
  {
    name: 'levscream_link',
    added: true,
    address: '0x1e0F7D116ffB998EeC879B96698222D1Ee8d87CB',
    tokensBeingDumped: ['0xe0654C8e6fd4D733349ac7E09f6f23DA256bF475'],
    want: '0xb3654dc3D10Ea7645f8319668E8F54d2574FBdC8',
  },
  {
    name: 'Strategy_ProviderOfUSDCToHedgilSpookyJoint_wftm_usdc',
    added: true,
    address: '0x84a92b621897bf7e4a95e80d91b3ab7491e9db39',
    tokensBeingDumped: [],
    want: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
  },
  {
    name: 'Strategy_ProviderOfWFTMToHedgilSpookyJoint_wftm_usdc',
    added: true,
    address: '0x9b536FD704944110d5F742840a206C45f6858920',
    tokensBeingDumped: [],
    want: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
  },
  {
    name: 'LINK GenLender',
    added: true,
    address: '0xde39F0148496D42cd4e16563463fA5C6504CaA00',
    tokensBeingDumped: ['0xe0654C8e6fd4D733349ac7E09f6f23DA256bF475'],
    want: '0xb3654dc3D10Ea7645f8319668E8F54d2574FBdC8',
  },
  {
    name: 'LevGeist wftm',
    added: true,
    address: '0xdcfFee74ABDCf70453Bb798Be1b41462EDdbC692',
    tokensBeingDumped: ['0xd8321AA83Fb0a4ECd6348D4577431310A6E0814d'],
    want: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
  },
  {
    name: 'LevGeist wbtc',
    added: true,
    address: '0x0683B5B75bD0514B5604D3c79A61647d83A02A3f',
    tokensBeingDumped: ['0xd8321AA83Fb0a4ECd6348D4577431310A6E0814d'],
    want: '0x321162Cd933E2Be498Cd2267a90534A804051b11',
  },
  {
    name: 'LevGeist weth',
    added: true,
    address: '0x108383E62992b9a90eD3A43c2c9FA26cA052D99b',
    tokensBeingDumped: ['0xd8321AA83Fb0a4ECd6348D4577431310A6E0814d'],
    want: '0x74b23882a30290451A17c44f4F05243b6b58C76d',
  },
  {
    name: 'LevGeist usdc',
    added: true,
    address: '0xA01Fa67B1681CDa1148E19a65D42Cc6c2D4215e1',
    tokensBeingDumped: ['0xd8321AA83Fb0a4ECd6348D4577431310A6E0814d'],
    want: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
  },
  {
    name: 'LevGeist mim',
    added: true,
    address: '0x2d960e1E1098681c124C111b206316772Fe023d8',
    tokensBeingDumped: ['0xd8321AA83Fb0a4ECd6348D4577431310A6E0814d'],
    want: '0x82f0B8B456c1A451378467398982d4834b6829c1',
  },
  {
    name: 'LevGeist dai',
    added: true,
    address: '0x9e856E75Fe2F95e9907DFe5F98EA9Bd819B6ED93',
    tokensBeingDumped: ['0xd8321AA83Fb0a4ECd6348D4577431310A6E0814d'],
    want: '0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E',
  },
  {
    name: 'Boo Xboo Hec',
    added: true,
    address: '0x76821Cdcad8Cae7aff53680e215E63EB54d6e6ca',
    tokensBeingDumped: ['0x5C4FDfc5233f935f20D2aDbA572F770c2E377Ab0'],
    want: '0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE',
  },
  {
    name: 'Boo Xboo Solidex',
    added: true,
    address: '0x768F43717899FD0f1B45Ea7f23b66e191348073E',
    tokensBeingDumped: [], //only yswaps
    want: '0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE',
  },
  {
    name: 'Wftm Anyftm veLp Solidex to YFI',
    added: true,
    address: '0x526f9FcD4db76878B62a450F1BD79cF38f036cc1',
    tokensBeingDumped: [], //only yswaps
    want: '0x29b0Da86e484E1C0029B56e817912d778aC0EC69',
  },
  {
    name: 'fBeets autocompounder',
    added: true,
    address: '0x5Df3E97e96FC04ae1F75A9D07A141348E4B07E45',
    tokensBeingDumped: [], //only yswaps
    want: '0xfcef8a994209d6916eb2c86cdd2afd60aa6f54b1',
  },
  {
    name: 'Strategy_ProviderOfUSDTToHedgilSpookyJoint_wftm_usdt',
    added: true,
    address: '0xc7a336925674EFeef22cEB56364e3658B8a0D467',
    tokensBeingDumped: [],
    want: '0x049d68029688eAbF473097a2fC38ef61633A3C7A',
  },
  {
    name: 'Strategy_ProviderOfWFTMToHedgilSpookyJoint_wftm_usdt',
    added: true,
    address: '0x4183e99e7C3874F85d195698AFb7ee1289DA0AFe',
    tokensBeingDumped: [],
    want: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
  },
  {
    name: 'Strategy_ProviderOfDAIToHedgilSpookyJoint_wftm_dai',
    added: true,
    address: '0x84f9E6d5D28Edf0AE873A4d84903716684f473D5',
    tokensBeingDumped: [],
    want: '0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E',
  },
  {
    name: 'Strategy_ProviderOfWFTMToHedgilSpookyJoint_wftm_dai',
    added: true,
    address: '0x60fa432fc8494FE0b7A7654295e178F6F2f22405',
    tokensBeingDumped: [],
    want: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
  },
  {
    name: 'Strategy_ProviderOfMIMToHedgilSpookyJoint_wftm_mim',
    added: true,
    address: '0xD58003b2Bac011b67C108b24e5deb1B22c70Fd1f',
    tokensBeingDumped: [],
    want: '0x82f0B8B456c1A451378467398982d4834b6829c1',
  },
  {
    name: 'Strategy_ProviderOfWFTMToHedgilSpookyJoint_wftm_mim',
    added: true,
    address: '0x15faeCDDAD6f3073954b29761b94b0b28321586f',
    tokensBeingDumped: [],
    want: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
  },
  {
    name: 'yfi_woofy_veLp_Oxdao',
    added: true,
    address: '0xb99d6662127d9A3c68Bc949679f364E1739E2CA1',
    tokensBeingDumped: [],
    want: '0x29b0Da86e484E1C0029B56e817912d778aC0EC69',
  },
  {
    name: 'Strategy_ProviderOfBTCToHedgilSpookyJoint_wftm_btc',
    added: true,
    address: '0x7114cAD096731F4d0B8E0De6e7CeDc189A462dce',
    tokensBeingDumped: [],
    want: '0x321162Cd933E2Be498Cd2267a90534A804051b11',
  },
  {
    name: 'Strategy_ProviderOfWFTMToHedgilSpookyJoint_wftm_btc',
    added: true,
    address: '0x4bd6976358e419Ce96103c70B776C273A9f4a8AD',
    tokensBeingDumped: [],
    want: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
  },
  {
    name: 'Strategy_ProviderOfETHToHedgilSpookyJoint_wftm_eth',
    added: true,
    address: '0xA4F10BC80F6c5cf6A34F828cb53c243eB1976Da8',
    tokensBeingDumped: [],
    want: '0x74b23882a30290451A17c44f4F05243b6b58C76d',
  },
  {
    name: 'Strategy_ProviderOfWFTMToHedgilSpookyJoint_wftm_eth',
    added: true,
    address: '0x61D5ed97b899347c1F286a9a67622d337D0e61fE',
    tokensBeingDumped: [],
    want: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
  },
  {
    name: 'Strategy_StrategyLenderYieldOptimiserBoo_luna_sdx_beftm',
    added: true,
    address: '0x4CE40A36A018457F8E0AA7C4a12Cc7ebf228B20F',
    tokensBeingDumped: [],
    want: '0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE',
  },
];

export const tendConfigurations: StrategyConfiguration[] = [];
