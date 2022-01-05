import hardhatConfig from '../commons/hardhat.config';

const config = hardhatConfig({
  networks: ['mainnet', 'ropsten', 'polygon', 'fantom'],
  namedAccounts: {
    deployer: 0, // yMECH Alice
    governor: {
      default: 0, // yMECH Alice
      1: '0xfeb4acf3df3cdea7399794d0869ef76a6efaff52', // ychad
      250: '0x9f2A061d6fEF20ad3A656e23fd9C814b75fd5803', // ymechs msig
    },
    yMech: '0xB82193725471dC7bfaAB1a3AB93c7b42963F3265', // yMECH b0dhi
  },
  solidity: {
    compilers: [
      {
        version: '0.8.9',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.8.4',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.5.17',
      },
    ],
  },
});

export default config;
