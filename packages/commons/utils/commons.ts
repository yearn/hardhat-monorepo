import { Transaction } from 'ethers';
import { encode } from 'rlp';

export const normalizeAddress = (address: string): string => address.toLowerCase();

// Ref: https://eips.ethereum.org/EIPS/eip-2718, https://eips.ethereum.org/EIPS/eip-2930 and https://eips.ethereum.org/EIPS/eip-1559
export const getRawTransaction = (transaction: Transaction): string => {
    let rawTransaction: string = '';
    if (transaction.type! == 0) {
      const executorTx = encode([
        transaction.nonce,
        transaction.gasPrice!.toNumber(),
        transaction.gasLimit.toNumber(),
        transaction.to!,
        transaction.value.toNumber(),
        transaction.data,
        transaction.v!,
        transaction.r!,
        transaction.s!,
      ]);
      rawTransaction = `0x${executorTx.toString('hex')}`;
    } else if (transaction.type! == 1) {
      const executorTx = encode([
        transaction.chainId,
        transaction.nonce,
        transaction.gasPrice!.toNumber(),
        transaction.gasLimit.toNumber(),
        transaction.to!,
        transaction.value.toNumber(),
        transaction.data,
        [],
        transaction.v!,
        transaction.r!,
        transaction.s!,
      ]);
      rawTransaction = `0x01${executorTx.toString('hex')}`;
    } else if (transaction.type! == 2) {
      const executorTx = encode([
        transaction.chainId,
        transaction.nonce,
        transaction.maxPriorityFeePerGas!.toNumber(),
        transaction.maxFeePerGas!.toNumber(),
        transaction.gasLimit.toNumber(),
        transaction.to!,
        transaction.value.toNumber(),
        transaction.data,
        [], // access list
        transaction.v!,
        transaction.r!,
        transaction.s!,
      ]);
      rawTransaction = `0x02${executorTx.toString('hex')}`;
    }
    return rawTransaction;
  }