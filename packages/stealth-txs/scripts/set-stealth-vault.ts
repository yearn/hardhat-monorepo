import { StealthERC20, StealthRelayer } from '@typechained';
import { BigNumber, BytesLike, ContractTransaction, utils } from 'ethers';
import { ethers } from 'hardhat';
import moment from 'moment';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import * as contracts from '../utils/contracts';

const generateRandomNumber = (min: number, max: number): string => {
  return `${Math.floor(Math.random() * (max - min) + min)}`;
};

async function execute() {
  const stealthRelayer = await ethers.getContractAt<StealthRelayer>(
    'contracts/StealthRelayer.sol:StealthRelayer',
    contracts.stealthRelayer.goerli
  );
  const tx = await stealthRelayer.setStealthVault(contracts.stealthVault.goerli);
  console.log('Set stealth vault:', tx.hash);
}

execute()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
