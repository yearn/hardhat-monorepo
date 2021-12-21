import 'dotenv/config';
import _ from 'lodash';
import { KMS } from 'aws-sdk';
import { ClientConfiguration } from 'aws-sdk/clients/kms';
const deasync = require('deasync');

const DEFAULT_CLIENT_CONFIGURATION: ClientConfiguration = {
  apiVersion: '2014-11-01',
  region: 'us-east-1',
};

const kms = new KMS(DEFAULT_CLIENT_CONFIGURATION);

const encrypt = async (stringToEncrypt: string): Promise<string> => {
  const data = await kms
    .encrypt({
      KeyId: process.env.KMS_KEY_ID as string,
      Plaintext: Buffer.from(stringToEncrypt),
    })
    .promise();
  return data.CiphertextBlob!.toString('base64');
};

const encryptSeveral = async (plainStrings: string[]): Promise<string[]> => {
  return await Promise.all(_.map(plainStrings, (plainString) => encrypt(plainString)));
};

const decryptSync = (encryptedString: string): string => {
  // encryptedString is a plain PrivateKey (default privateKey)
  if (encryptedString === '0x0000000000000000000000000000000000000000000000000000000000000bad') return encryptedString;

  let decryptedInfo: KMS.DecryptResponse | unknown = undefined;
  let kill: boolean = false;

  kms.decrypt(
    {
      CiphertextBlob: Buffer.from(encryptedString, 'base64'),
    },
    (error, data) => {
      if (error) {
        console.log('MKS:decryptSync error:');
        console.log(error);
        kill = true;
      } else {
        decryptedInfo = data;
      }
    }
  );

  while (decryptedInfo === undefined && !kill) {
    require('deasync').sleep(25);
  }
  if (!decryptedInfo) return encryptedString;
  return (decryptedInfo as KMS.DecryptResponse).Plaintext!.toString();
};

const decrypt = async (encryptedString: string): Promise<string> => {
  const decryptedInfo = await kms
    .decrypt({
      CiphertextBlob: Buffer.from(encryptedString, 'base64'),
    })
    .promise();
  return decryptedInfo.Plaintext!.toString();
};

const decryptSeveral = async (encryptedStrings: string[]): Promise<string[]> => {
  return await Promise.all(_.map(encryptedStrings, (encryptedString) => decrypt(encryptedString)));
};

const decryptSeveralSync = (encryptedStrings: string[]): string[] => {
  return encryptedStrings.map((encryptedString) => decryptSync(encryptedString));
};

const getDecryptedPrivateKey = async (): Promise<string> => {
  return await decrypt(process.env.ENCRYPTED_PRIVATE_KEY as string);
};

const getDecryptedPrivateKeySync = (): string => {
  return decryptSync(process.env.ENCRYPTED_PRIVATE_KEY as string);
};

export default {
  getDecryptedPrivateKey,
  encrypt,
  encryptSeveral,
  decrypt,
  decryptSeveral,
  decryptSync,
  decryptSeveralSync,
  getDecryptedPrivateKeySync,
};
