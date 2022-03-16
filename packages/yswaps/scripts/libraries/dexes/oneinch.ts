import { BigNumber } from '@ethersproject/bignumber';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import qs from 'qs';
import { BaseDexLibrary, DexLibrary, DexLibrarySwapProps, DexLibrarySwapResponse } from '../types';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

// Ref.: https://docs.1inch.io/docs/aggregation-protocol/api/swap-params
export type SwapParams = {
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string;
  fromAddress: string;
  slippage: number;
  protocols?: string[];
  destReceiver?: string;
  referrer?: string;
  fee?: number;
  gasPrice?: BigNumber;
  burnChi?: boolean;
  complexityLevel?: string;
  connectorTokens?: string;
  allowPartialFill?: boolean;
  disableEstimate?: boolean;
  gasLimit?: number;
  parts?: number;
  mainRouteParts?: number;
};
type Token = {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
  logoURI: string;
};
type SwapPart = {
  name: string;
  part: number;
  fromTokenAddress: string;
  toTokenAddress: string;
};
type SwapProtocol = SwapPart[];
type SwapProtocols = SwapProtocol[];

export type SwapResponse = {
  fromToken: Token;
  toToken: Token;
  fromTokenAmount: BigNumber;
  toTokenAmount: BigNumber;
  minAmountOut?: BigNumber;
  protocols: SwapProtocols;
  tx: {
    from: string;
    to: string;
    data: string;
    value: BigNumber;
    gasPrice: BigNumber;
    gas: BigNumber;
  };
};

export class OneInchLibrary extends BaseDexLibrary implements DexLibrary {
  async swap({ tokenIn, amountIn, tokenOut, strategy }: DexLibrarySwapProps): Promise<DexLibrarySwapResponse> {
    const axiosProtocolResponse = (await axios.get(`https://api.1inch.exchange/v3.0/${this._network.chainId}/protocols`)) as any;
    const protocols = (axiosProtocolResponse.data.protocols as string[]).filter((protocol) => {
      return protocol.includes('ONE_INCH_LIMIT_ORDER') == false;
    });
    const swapParams: SwapParams = {
      fromTokenAddress: tokenIn,
      toTokenAddress: tokenOut,
      amount: amountIn.toString(),
      fromAddress: strategy,
      protocols,
      slippage: 0.5, // 0.5%
      allowPartialFill: false,
    };
    try {
      const response = await axios.get(`https://api.1inch.exchange/v3.0/${this._network.chainId}/swap?${qs.stringify(swapParams)}`);
      const swapResponse = response.data as SwapResponse;
      return {
        dex: 'zrx',
        executionTransactionData: '',
        swapTransactionData: '',
        data: swapResponse.tx.data,
        amountOut: BigNumber.from(swapResponse.minAmountOut),
        path: [tokenIn, tokenOut],
      };
    } catch (err: any) {
      const code = err.response ? err.response.data.code : err.code;
      throw new Error(`Error code: ${code}. Reason: ${err.response?.data.reason}`);
    }
  }
}
