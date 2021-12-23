import { hexDataLength } from '@ethersproject/bytes';
import { pack } from '@ethersproject/solidity';
import { BigNumber, PopulatedTransaction } from 'ethers';

// h/t to https://github.com/gnosis/ethers-multisend

export enum OperationType {
  Call = 0,
  DelegateCall = 1,
}

export enum MulticallOptimization {
  None = 0,
  CallOnly = 1,
  SameTo = 2,
  NoValue = 4,
}

export interface MetaTransaction {
  readonly to: string;
  readonly value: string;
  readonly data: string;
  readonly operation?: OperationType;
}

/// Encodes the transaction as packed bytes of:
/// - `operation` as a `uint8` with `0` for a `call` or `1` for a `delegatecall` (=> 1 byte),
/// - `to` as an `address` (=> 20 bytes),
/// - `value` as a `uint256` (=> 32 bytes),
/// -  length of `data` as a `uint256` (=> 32 bytes),
/// - `data` as `bytes`.
const encodePacked = (tx: MetaTransaction) =>
  pack(
    ['uint8', 'address', 'uint256', 'uint256', 'bytes'],
    [tx.operation || OperationType.Call, tx.to, tx.value, hexDataLength(tx.data), tx.data]
  );

const remove0x = (hexString: string) => hexString.substr(2);

// Optimized

/// Encodes the transaction as packed bytes of:
/// - `to` as an `address` (=> 20 bytes),
/// - `value` as a `uint256` (=> 32 bytes),
/// -  length of `data` as a `uint256` (=> 32 bytes),
/// - `data` as `bytes`.
const encodePackedOptimizedCall = (tx: MetaTransaction) =>
  pack(['address', 'uint256', 'uint256', 'bytes'], [tx.to, tx.value, hexDataLength(tx.data), tx.data]);

/// Encodes the transaction as packed bytes of:
/// - `operation` as a `uint8` with `0` for a `call` or `1` for a `delegatecall` (=> 1 byte),
/// - `value` as a `uint256` (=> 32 bytes),
/// -  length of `data` as a `uint256` (=> 32 bytes),
/// - `data` as `bytes`.
const encodePackedOptimizedSameTo = (tx: MetaTransaction) =>
  pack(['uint8', 'uint256', 'uint256', 'bytes'], [tx.operation, tx.value, hexDataLength(tx.data), tx.data]);

/// Encodes the transaction as packed bytes of:
/// - `operation` as a `uint8` with `0` for a `call` or `1` for a `delegatecall` (=> 1 byte),
/// - `to` as an `address` (=> 20 bytes),
/// -  length of `data` as a `uint256` (=> 32 bytes),
/// - `data` as `bytes`.
const encodePackedOptimizedNoValue = (tx: MetaTransaction) =>
  pack(['uint8', 'address', 'uint256', 'bytes'], [tx.operation, tx.to, hexDataLength(tx.data), tx.data]);

/// Encodes the transaction as packed bytes of:
/// - `value` as a `uint256` (=> 32 bytes),
/// -  length of `data` as a `uint256` (=> 32 bytes),
/// - `data` as `bytes`.
const encodePackedOptimizedCallSameTo = (tx: MetaTransaction) =>
  pack(['uint256', 'uint256', 'bytes'], [tx.value, hexDataLength(tx.data), tx.data]);

/// Encodes the transaction as packed bytes of:
/// - `to` as an `address` (=> 20 bytes),
/// -  length of `data` as a `uint256` (=> 32 bytes),
/// - `data` as `bytes`.
const encodePackedOptimizedCallNoValue = (tx: MetaTransaction) =>
  pack(['address', 'uint256', 'bytes'], [tx.to, hexDataLength(tx.data), tx.data]);

/// Encodes the transaction as packed bytes of:
/// -  length of `data` as a `uint256` (=> 32 bytes),
/// - `data` as `bytes`.
const encodePackedOptimizedCallSameToNoValue = (tx: MetaTransaction) => pack(['uint256', 'bytes'], [hexDataLength(tx.data), tx.data]);

// dynamic optimization
export const mergeTransactions = (transactions: PopulatedTransaction[]) => {
  const parsedTxs = transactions.map((transaction) => ({
    to: transaction.to as string,
    value: BigNumber.from(transaction.value || 0).toString(),
    data: transaction.data as string,
    operation: OperationType.Call, // Only Call are allowed
  }));

  return encodeMulti(parsedTxs);
};

export const encodeMulti = (transactions: readonly MetaTransaction[]): string => {
  // find MulticallOptimization
  let optimizations: number = MulticallOptimization.None;
  let optimizationPrefixesPacked: string = '';

  if (transactions.filter((tx) => tx.operation == OperationType.DelegateCall).length === 0) {
    optimizations += MulticallOptimization.CallOnly;
  }

  if (transactions.length > 1 && transactions.filter((tx) => tx.to != transactions[0].to).length === 0) {
    optimizations += MulticallOptimization.SameTo;
    optimizationPrefixesPacked += remove0x(pack(['address'], [transactions[0].to]));
  }

  if (transactions.filter((tx) => tx.value != BigNumber.from(0).toString()).length === 0) {
    optimizations += MulticallOptimization.NoValue;
  }

  /// - `multicallOptimization` as an `uint8` (=> 1 byte),
  const optimizationsPacked = remove0x(pack(['uint8'], [optimizations]));
  let optimizationFunction;
  switch (optimizations) {
    case MulticallOptimization.None:
      // console.log('optimizing with: encodePacked')
      optimizationFunction = encodePacked;
      break;
    case MulticallOptimization.CallOnly:
      // console.log('optimizing with: encodePackedOptimizedCall')
      optimizationFunction = encodePackedOptimizedCall;
      break;
    case MulticallOptimization.SameTo:
      // console.log('optimizing with: encodePackedOptimizedSameTo')
      optimizationFunction = encodePackedOptimizedSameTo;
      break;
    case MulticallOptimization.NoValue:
      // console.log('optimizing with: encodePackedOptimizedNoValue')
      optimizationFunction = encodePackedOptimizedNoValue;
      break;
    case MulticallOptimization.CallOnly + MulticallOptimization.SameTo:
      // console.log('optimizing with: encodePackedOptimizedCallSameTo')
      optimizationFunction = encodePackedOptimizedCallSameTo;
      break;
    case MulticallOptimization.CallOnly + MulticallOptimization.NoValue:
      // console.log('optimizing with: encodePackedOptimizedCallNoValue')
      optimizationFunction = encodePackedOptimizedCallNoValue;
      break;
    case MulticallOptimization.CallOnly + MulticallOptimization.SameTo + MulticallOptimization.NoValue:
      // console.log('optimizing with: encodePackedOptimizedCallSameToNoValue')
      optimizationFunction = encodePackedOptimizedCallSameToNoValue;
      break;
  }

  if (!optimizationFunction) throw new Error('Invalid Optimizations');
  return '0x' + optimizationsPacked + optimizationPrefixesPacked + transactions.map(optimizationFunction).map(remove0x).join('');
};
