import { utils } from 'ethers';
import { ethers } from 'hardhat';
import moment from 'moment';
import * as contracts from '../utils/contracts';

const generateRandomNumber = (min: number, max: number): string => {
  return `${Math.floor(Math.random() * (max - min) + min)}`;
};

async function execute() {
  const [, caller] = await ethers.getSigners();
  const stealthRelayer = await ethers.getContractAt('contracts/StealthRelayer.sol:StealthRelayer', contracts.stealthRelayer.goerli, caller);
  const stealthERC20 = await ethers.getContractAt('contracts/mock/StealthERC20.sol:StealthERC20', contracts.stealthERC20.goerli, caller);
  const rawTx = await stealthERC20.populateTransaction.stealthMint(caller.address, utils.parseEther('666'));
  const hash = utils.formatBytes32String(generateRandomNumber(1, 1000000));
  console.log('hash', hash);
  await stealthRelayer.executeWithoutBlockProtection(stealthERC20.address, rawTx.data, hash);
  console.log('sent at', moment().unix());
  console.log('Executing without block protection');
}

execute()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
