import 'dotenv/config';
import kms from '../tools/kms';

// const DEFAULT_ACCOUNT = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
const MAX_ACCOUNTS = 10;

export function getNodeUrl(networkName: string): string {
  const uri = process.env[`ETH_NODE_URI_${networkName.toUpperCase()}`] as string;

  if (!uri) throw new Error(`No uri for network ${networkName}`);

  return uri;
}

export function getMnemonic(networkName: string): string {
  const mnemonic = process.env[`MNEMONIC_${networkName.toUpperCase()}`] as string;
  if (!mnemonic) throw new Error(`No mnemonic for network ${networkName}`);
  return mnemonic;
}

export function getPrivateKeys(networkName: string): string[] {
  const privateKeys = [];
  for (let i = 1; i <= MAX_ACCOUNTS; i ++) {
    const privateKey = process.env[`${networkName.toUpperCase()}_${i}_PRIVATE_KEY`];
    if (!!privateKey) privateKeys.push(privateKey);
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
