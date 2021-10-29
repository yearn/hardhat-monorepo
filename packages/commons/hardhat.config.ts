import 'dotenv/config';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import '@typechain/hardhat';
import '@typechain/hardhat/dist/type-extensions';
import { removeConsoleLog } from 'hardhat-preprocessor';
import 'hardhat-gas-reporter';
import 'hardhat-deploy';
import 'solidity-coverage';
import { HardhatUserConfig, MultiSolcUserConfig, NetworksUserConfig, SolcUserConfig, SolidityUserConfig } from 'hardhat/types';
import { DEFAULT_ACCOUNT, getNodeUrl } from './utils/network';
import 'tsconfig-paths/register';

type NamedAccounts = {
  [name: string]:
    | string
    | number
    | {[network: string]: null | number | string}
}

const networks: NetworksUserConfig = process.env.TEST
  ? {}
  : {
      hardhat: {
        forking: {
          enabled: process.env.FORK ? true : false,
          url: getNodeUrl('mainnet'),
        },
      },
      localhost: {
        url: getNodeUrl('localhost'),
        live: false,
        accounts: [(process.env.LOCAL_PRIVATE_KEY as string) || DEFAULT_ACCOUNT],
        tags: ['local'],
      },
      mainnet: {
        url: getNodeUrl('mainnet'),
        accounts: [(process.env.MAINNET_PRIVATE_KEY as string) || DEFAULT_ACCOUNT],
        tags: ['production'],
      },
      polygon: {
        url: getNodeUrl('polygon'),
        accounts: [(process.env.POLYGON_PRIVATE_KEY as string) || DEFAULT_ACCOUNT],
        tags: ['production'],
      },
      ftm: {
        url: getNodeUrl('ftm'),
        accounts: [(process.env.FTM_PRIVATE_KEY as string) || DEFAULT_ACCOUNT],
        tags: ['production'],
      },
    };

const defaultConfig: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  mocha: {
    timeout: process.env.MOCHA_TIMEOUT || 300000,
  },
  networks,
  gasReporter: {
    currency: process.env.COINMARKETCAP_DEFAULT_CURRENCY || 'USD',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    enabled: true,
    outputFile: 'gasReporterOutput.json',
  },
  preprocess: {
    eachLine: removeConsoleLog((hre) => hre.network.name !== 'hardhat'),
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  typechain: {
    outDir: 'typechained',
    target: 'ethers-v5',
  },
};

const getConfig = ({ 
  solidity, 
  namedAccounts 
}: { 
  solidity: SolcUserConfig | MultiSolcUserConfig,
  namedAccounts?: NamedAccounts
}): HardhatUserConfig => {
  namedAccounts = namedAccounts ?? {};
  const config = {
    ...defaultConfig,
    namedAccounts,
    solidity
  };
  if (process.env.TEST) {
    (config.solidity as MultiSolcUserConfig).compilers = (config.solidity as MultiSolcUserConfig).compilers.map((compiler) => {
      return {
        ...compiler,
        outputSelection: {
          '*': {
            '*': ['storageLayout'],
          },
        },
      };
    });
  }
  
  return config;
}

export default getConfig;
