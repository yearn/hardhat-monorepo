export const chainIds: { [network: string]: number } = {
  mainnet: 1,
  goerli: 5,
  ropsten: 3,
  rinkeby: 4,
};
export const getChainId = (network: string): number => {
  return chainIds[network];
};

const reporterPrivateKeys: { [network: string]: string } = {
  mainnet: process.env.MAINNET_PRIVATE_KEY as string,
  goerli: process.env.GOERLY_2_PRIVATE_KEY as string,
  ropsten: process.env.ROPSTEN_2_PRIVATE_KEY as string,
  rinkeby: process.env.RINKEBY_2_PRIVATE_KEY as string,
};

export const getReporterPrivateKey = (network: string): string => {
  return reporterPrivateKeys[network];
};

const webSocketsUrls: { [network: string]: string } = {
  mainnet: process.env.MAINNET_WS_URL as string,
  goerli: process.env.GOERLI_WS_URL as string,
  ropsten: process.env.ROPSTEN_WS_URL as string,
  rinkeby: process.env.RINKEBY_WS_URL as string,
};

export const getWSUrl = (network: string): string => {
  return webSocketsUrls[network];
};
