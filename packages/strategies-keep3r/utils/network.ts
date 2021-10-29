import 'dotenv/config';

export type SUPPORTED_NETWORKS = 'mainnet' | 'rinkeby' | 'goerli' | 'polygon' | 'ftm';

export const NETWORK_ID_NAMES: { [chainId: number]: SUPPORTED_NETWORKS } = {
  1: 'mainnet',
  4: 'rinkeby',
  5: 'goerli',
  137: 'polygon',
  250: 'ftm',
};

export function getNodeUrl(networkName: string): string {
  if (networkName) {
    const uri = process.env[`ETH_NODE_URI_${networkName.toUpperCase()}`];
    if (uri && uri !== '') {
      return uri;
    }
  }

  if (networkName === 'localhost') {
    // do not use ETH_NODE_URI
    return 'http://localhost:8545';
  }

  let uri = process.env.ETH_NODE_URI;
  if (uri) {
    uri = uri.replace('{{networkName}}', networkName);
  }
  if (!uri || uri === '') {
    // throw new Error(`environment variable "ETH_NODE_URI" not configured `);
    return '';
  }
  if (uri.indexOf('{{') >= 0) {
    throw new Error(`invalid uri or network not supported by node provider : ${uri}`);
  }
  return uri;
}

export function getMnemonic(networkName?: string): string {
  if (networkName) {
    const mnemonic = process.env[`MNEMONIC_${networkName.toUpperCase()}`];
    if (mnemonic && mnemonic !== '') {
      return mnemonic;
    }
  }

  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic || mnemonic === '') {
    return 'test test test test test test test test test test test junk';
  }
  return mnemonic;
}

export const DEFAULT_ACCOUNT = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

export function accounts(networkName?: string): { mnemonic: string } {
  return { mnemonic: getMnemonic(networkName) };
}
