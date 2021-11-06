import hardhatConfig from '../commons/hardhat.config';

const config = hardhatConfig({
  networks: ['mainnet'],
  solidity: {
    compilers: [
      {
        version: '0.8.4',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
});

export default config;
