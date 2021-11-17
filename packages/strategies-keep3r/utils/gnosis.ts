import axios from 'axios';

export async function getSafeQueuedTransactions(chainId: number, safeAddress: string) {
  try {
    const res = await axios.get(`https://safe-client.gnosis.io/v1/chains/${chainId}/safes/${safeAddress}/transactions/queued`);
    return res.data.results
      .filter((result: { type: string }) => result.type === 'TRANSACTION')
      .map((result: { transaction: any }) => result.transaction);
  } catch (error) {
    console.error(error);
    return;
  }
}
export async function getTransaction(chainId: number, id: string) {
  try {
    const res = await axios.get(`https://safe-client.gnosis.io/v1/chains/${chainId}/transactions/${id}`);
    return res.data;
  } catch (error) {
    console.error(error);
    return;
  }
}

export async function getGasPrice() {
  try {
    const res = await axios.get(`https://blocknative-api.herokuapp.com/data`);
    return res.data.estimatedPrices[1].price;
  } catch (error) {
    console.error(error);
    return;
  }
}

export interface SafeTransaction {
  id: string;
  timestamp: number;
  txStatus: 'AWAITING_CONFIRMATIONS' | 'AWAITING_EXECUTION';
  txInfo: {
    type: string; // "Custom",
    to: {
      value: string;
    };
    dataSize: string;
    value: string;
    methodName: string;
    isCancellation: boolean;
  };
  executionInfo: {
    type: string; // "MULTISIG",
    nonce: number;
    confirmationsRequired: number;
    confirmationsSubmitted: number;
    missingSigners?: { value: string }[];
  };
}

export interface SafeTransactionData {
  // "executedAt":null,
  // "txStatus":"AWAITING_EXECUTION",
  // "txInfo":{
  //   "type":"Custom",
  //   "to":{
  //     "value":"0x23DC650A7760cA37CafD14AF5f1e0ab62cE50FA4"
  //   },
  //   "dataSize":"36",
  //   "value":"0",
  //   "methodName":"setGuard",
  //   "isCancellation":false
  // },
  txData: {
    hexData: string;
    dataDecoded: {
      method: string;
      parameters: {
        name: string;
        type: string;
        value: string;
      }[];
    };
    to: {
      value: string;
    };
    value: string;
    operation: number;
  };
  detailedExecutionInfo: {
    type: string; //"MULTISIG",
    submittedAt: number;
    nonce: number;
    safeTxGas: string;
    baseGas: string;
    gasPrice: string;
    gasToken: string;
    refundReceiver: {
      value: string;
    };
    safeTxHash: string;
    executor: null;
    signers: { value: string }[];
    confirmationsRequired: number;
    confirmations: {
      signer: {
        value: string;
      };
      signature: string;
      submittedAt: number;
    }[];
  };
  // "txHash":null
}
