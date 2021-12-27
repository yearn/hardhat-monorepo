import { JsonRpcSigner } from '@ethersproject/providers';
import { ethers, network } from 'hardhat';

export const impersonate = async (address: string): Promise<JsonRpcSigner> => {
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });
  await ethers.provider.send('hardhat_setBalance', [address, '0xffffffffffffffff']);
  return ethers.provider.getSigner(address);
};
