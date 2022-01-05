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
import { HardhatUserConfig, MultiSolcUserConfig, NetworksUserConfig, SolcUserConfig } from 'hardhat/types';
import { getAccounts, getNodeUrl } from './utils/network';
import 'tsconfig-paths/register';

type NamedAccounts = {
  [name: string]:
    | string
    | number
    | {[network: string]: null | number | string}
}

const encrypted = !!process.env.ENCRYPTED_CREDENTIALS && process.env.ENCRYPTED_CREDENTIALS === 'true';

const getNetworks = (networksName: string[]): NetworksUserConfig => {
  if (!!process.env.TEST || process.argv[process.argv.length - 1] == 'compile') return {};
  const networks: NetworksUserConfig = {};
  networksName.forEach((network: string) => {
    networks[network] = {
      url: getNodeUrl(network),
      accounts: getAccounts({ typeOfAccount: 'privateKey', networkName: network, encrypted }),
    }
  });
  return networks;
};

const defaultConfig: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  mocha: {
    timeout: process.env.MOCHA_TIMEOUT || 300000,
  },
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
  networks,
  namedAccounts,
  solidity, 
}: { 
  networks?: string[],
  solidity: SolcUserConfig | MultiSolcUserConfig,
  namedAccounts?: NamedAccounts
}): HardhatUserConfig => {
  namedAccounts = namedAccounts ?? {};
  networks = networks ?? [];
  const networksConfigs = getNetworks(networks);
  const config = {
    ...defaultConfig,
    networks: networksConfigs,
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
