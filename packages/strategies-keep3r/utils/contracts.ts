import { SUPPORTED_NETWORKS } from '@utils/network';

export type ContractChainAddress = {
  [chainName in SUPPORTED_NETWORKS]?: string;
};

export const weth: ContractChainAddress = {
  fantom: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
};

export const stealthVault: ContractChainAddress = {
  mainnet: '0xC454F4E1DDB39c8De9663287D52b0E4Feb4cA45E',
  goerli: '0x093a60a183245b9ce41fBe5Bd0ef6b1A0AA52A65',
  rinkeby: '0xe72d641f09a48cce6997377d13b2Ac7029c642b2',
};

export const stealthRelayer: ContractChainAddress = {
  mainnet: '0x0a61c2146A7800bdC278833F21EBf56Cd660EE2a',
  goerli: '0x6ABEF8eF9dF993c5a8f32484E0ae248281227C83',
  rinkeby: '0x292fd0E1De7648bA08691dBDe97313Cdcdc161cb',
};

export const harvestV2Keep3rStealthJob: ContractChainAddress = {
  mainnet: '0x2150b45626199CFa5089368BDcA30cd0bfB152D6',
  goerli: '',
};

export const crvStrategyKeep3rJob2: ContractChainAddress = {
  mainnet: '0xeE15010105b9BB564CFDfdc5cee676485092AEDd',
  goerli: '',
};

export const crvStrategyKeep3rStealthJob2: ContractChainAddress = {
  mainnet: '0x41edFD5575fa4590A20f669bBDa6C4Ae367cD0d8',
  goerli: '',
};

export const mechanicsRegistry: ContractChainAddress = {
  mainnet: '0xE8d5A85758FE98F7Dce251CAd552691D49b499Bb',
  polygon: '0x7A99923aA2efa71178BB11294349EC1F6b23a814',
  fantom: '0x7f462B92F92114A2D57A03e5Ae2DB5DA28b77d73',
};

export const v2Keeper: ContractChainAddress = {
  mainnet: '0x736D7e3c5a6CB2CE3B764300140ABF476F6CFCCF',
  polygon: '',
  fantom: '0xe72d641f09a48cce6997377d13b2Ac7029c642b2',
};

export const curveClaimableTokensHelper: ContractChainAddress = {
  mainnet: '0xEaD8d69dF1e75C81Ef63855a94309CC5374192bD',
};

export const blockProtection: ContractChainAddress = {
  mainnet: '0xCC268041259904bB6ae2c84F9Db2D976BCEB43E5',
};

export const vaultsRegistry: ContractChainAddress = {
  mainnet: '0x50c1a2eA0a861A967D9d0FFE2AE4012c2E053804',
  polygon: '',
  fantom: '0x727fe1759430df13655ddb0731dE0D0FDE929b04',
  arbitrumOne: '0x3199437193625DCcD6F9C9e98BDf93582200Eb1f',
};

export const vaultsRegistryHelper: ContractChainAddress = {
  mainnet: '',
  polygon: '',
  fantom: '0x8CC45f739104b3Bdb98BFfFaF2423cC0f817ccc1',
  arbitrumOne: '0x237C3623bed7D115Fc77fEB08Dd27E16982d972B',
};

export const tendV2Keep3rJob: ContractChainAddress = {
  mainnet: '0x2ef7801c6A9d451EF20d0F513c738CC012C57bC3',
};
export const betaTendV2Keep3rJob: ContractChainAddress = {
  mainnet: '0xf72D7E44ec3F79379912B8d0f661bE954a101159',
};

export const stealthSafeGuard: ContractChainAddress = {
  mainnet: '0xa6A8B8F06835d44E53Ae871b2EadbE659c335e5d', // ySwaps
  rinkeby: '0xC190B246e9fe7026240e464bf28c0ba645CD81c3',
};

export const stealthSafeGuardKeep3r: ContractChainAddress = {
  mainnet: '0xFfc5017858Ac656CffA3e4a253eC579678d9bbEa', // keep3r
};

export const multicall2: ContractChainAddress = {
  mainnet: '',
  fantom: '0x6cAfA5f64476769aAEc7c0Ae8D8E14c2a77272a2',
};

export const yOracle: ContractChainAddress = {
  mainnet: '0x0000000000000000000000000000000000000000',
  fantom: '0x0000000000000000000000000000000000000000',
};

export const baseFeeOracle: ContractChainAddress = {
  mainnet: '0xf8d0ec04e94296773ce20efbeea82e76220cd549',
  fantom: '',
};

export const tendV2DetachedJob: ContractChainAddress = {
  mainnet: '',
  fantom: '0xaB4b34e69Ae8599361709B0EC4A6dA539eFd7Fb8',
};

export const harvestV2DetachedJob: ContractChainAddress = {
  mainnet: '',
  fantom: '0x39cAcdb557CA1C4a6555E00203B4a00B1c1a94f8',
};

export const yMechanicsDefaultOwner: ContractChainAddress = {
  fantom: '0x9f2A061d6fEF20ad3A656e23fd9C814b75fd5803', // ymechs multisig
  arbitrumOne: '0x0000000031669Ab4083265E0850030fa8dEc8daf', // yKeeper
};
