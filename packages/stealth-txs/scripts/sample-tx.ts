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
  const [, submitter] = await ethers.getSigners();
  const stealthRelayer = await ethers.getContractAt<StealthRelayer>(
    'contracts/StealthRelayer.sol:StealthRelayer',
    contracts.stealthRelayer.goerli,
    submitter
  );
  const stealthERC20 = await ethers.getContractAt<StealthERC20>(
    'contracts/mock/StealthERC20.sol:StealthERC20',
    contracts.stealthERC20.goerli,
    submitter
  );
  const rawTx = await stealthERC20.populateTransaction.stealthMint(submitter.address, utils.parseEther('666'));
  console.log('submitter address', submitter.address);
  const hash = utils.formatBytes32String(generateRandomNumber(1, 100000000));
  console.log('random hash', hash);
  let submitted = false;
  let tx: TransactionResponse;

  while (!submitted) {
    try {
      // const pendingBlock = await ethers.provider.send('eth_getBlockByNumber', ['latest', false]);
      // const blockGasLimit = BigNumber.from(pendingBlock.gasLimit);
      // tx = await stealthRelayer.executeWithoutBlockProtection(stealthERC20.address, rawTx.data as BytesLike, hash, {
      //   gasLimit: blockGasLimit.sub(15_000),
      // });
      tx = await stealthRelayer.executeWithoutBlockProtection(stealthERC20.address, rawTx.data as BytesLike, hash, {
        gasLimit: 100000,
        // gasPrice: utils.parseUnits('0.5', 'gwei'),
        maxFeePerGas: utils.parseUnits('0.0001', 'gwei'),
        maxPriorityFeePerGas: utils.parseUnits('0.000009', 'gwei'),
      });
      console.log('tx hash', tx.hash);
      console.log('tx nonce', tx.nonce);
      console.log('sent at', moment().unix());
      console.log('Executing without block protection');
      submitted = true;
    } catch (err) {
      console.log(err);
    }
  }
  await tx!.wait();
  console.log('raw tx', tx!.raw!);
}

execute()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
