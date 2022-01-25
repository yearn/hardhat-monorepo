import 'dotenv/config';
import kms from '../tools/kms';

// const DEFAULT_ACCOUNT = '0x0000000000000000000000000000000000000000000000000000000000000bad';
const MAX_ACCOUNTS = 10;

export type SUPPORTED_NETWORKS = 'mainnet' | 'rinkeby' | 'goerli' | 'polygon' | 'fantom';

export const NETWORK_ID_NAMES: { [chainId: number]: SUPPORTED_NETWORKS } = {
  1: 'mainnet',
  4: 'rinkeby',
  5: 'goerli',
  137: 'polygon',
  250: 'fantom',
};

export function getNodeUrl(networkName: string): string {
  const uri = process.env[`ETH_NODE_URI_${networkName.toUpperCase()}`] as string;

  if (!uri) {
    console.warn(`No uri for network ${networkName}`);
    return '';
  } 

  return uri;
}

export function getMnemonic(networkName: string): string {
  const mnemonic = process.env[`MNEMONIC_${networkName.toUpperCase()}`] as string;
  if (!mnemonic) {
    console.warn(`No mnemonic for network ${networkName}`);
    return 'test test test test test test test test test test test junk';
  }
  return mnemonic;
}

export function getPrivateKeys(networkName: string): string[] {
  const privateKeys = [];
  for (let i = 1; i <= MAX_ACCOUNTS; i ++) {
    const privateKey = process.env[`${networkName.toUpperCase()}_${i}_PRIVATE_KEY`];
    if (!!privateKey) privateKeys.push(privateKey);
  }
  if (privateKeys.length === 0) {
    console.warn(`No private keys for network ${networkName}`);
    privateKeys.push('0x0000000000000000000000000000000000000000000000000000000000000bad');
  }
  return privateKeys;
}

export function getAccounts({
  typeOfAccount,
  networkName,
  encrypted
} : {
  typeOfAccount: 'mnemonic' | 'privateKey';
  networkName: string;
  encrypted: boolean;
}): { mnemonic: string } | string[] {
  if (typeOfAccount == 'privateKey') {
    let privateKeys = getPrivateKeys(networkName);
    if (encrypted) {
      privateKeys = kms.decryptSeveralSync(privateKeys);
    }
    return privateKeys;
  }
  let mnemonic = getMnemonic(networkName);
  if (encrypted) {
    mnemonic = kms.decryptSync(mnemonic);
  }
  return {
    mnemonic
  };
}
