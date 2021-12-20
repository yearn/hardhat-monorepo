import { encodeMulti, OperationType } from '@scripts/libraries/multicall';
import { BigNumber, Contract, PopulatedTransaction } from 'ethers';
// import { abi as MultiSendCallOnlyABI } from '@yearn/yswaps/contracts/libraries/MultiSendCallOnly.sol:MultiSendCallOnly.json';

let multiSendCallOnly: Contract;

// 0x40A2aCCbd92BCA938b02010E17A5b8929b49130D

export const getMultiSendCallOnly = () => multiSendCallOnly;

// export const deploy = async ({ owner }: { owner: Signer }) => {
//   multiSendCallOnly = await deployContract(owner, MultiSendCallOnlyABI);
//   return {
//     multiSendCallOnly,
//   };
// };

export const mergeTransactions = (transactions: PopulatedTransaction[]) => {
  return encodeMulti(transactions.map(transaction => ({
    to: transaction.to as string,
    value: BigNumber.from(transaction.value || 0).toString(),
    data: transaction.data as string,
    operation: OperationType.Call // Only Call are allowed
  })));
};
