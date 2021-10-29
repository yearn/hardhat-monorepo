import { BigNumber } from '@ethersproject/bignumber';
import axios from 'axios';
import axiosRetry from 'axios-retry';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export type SwapParams = {
  tokenIn: string;
  tokenOut: string;
  amountIn: BigNumber;
  fromAddress: string;
  slippage: number;
  protocols?: string;
  receiver?: string;
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

export const swap = async (chainId: number, swapParams: SwapParams): Promise<SwapResponse> => {
  let data: SwapResponse;
  try {
    const axiosProtocolResponse = (await axios.get(`https://api.1inch.exchange/v3.0/${chainId}/protocols`)) as any;
    const protocols = (axiosProtocolResponse.data.protocols as string[]).filter((protocol) => {
      return protocol.includes('ONE_INCH_LIMIT_ORDER') == false;
    });
    ({ data } = await axios.get(
      `https://api.1inch.exchange/v3.0/${chainId}/swap?fromTokenAddress=${swapParams.tokenIn}&toTokenAddress=${
        swapParams.tokenOut
      }&destReceiver=${swapParams.receiver}&amount=${swapParams.amountIn.toString()}&fromAddress=${swapParams.fromAddress}&slippage=${
        swapParams.slippage
      }&disableEstimate=${swapParams.disableEstimate}&allowPartialFill=${swapParams.allowPartialFill}&fee=${swapParams.fee}&gasLimit=${
        swapParams.gasLimit
      }&protocols=${protocols.join(',')}`
    ));
  } catch (err: any) {
    throw new Error(`Status code: ${err.response.data.statusCode}. Message: ${err.response.data.message}`);
  }
  if (swapParams.hasOwnProperty('slippage')) {
    const amountOut = BigNumber.from(data.toTokenAmount);
    data.minAmountOut = amountOut.sub(amountOut.mul(swapParams.slippage).div(100));
  }
  return data;
};

export default {
  swap,
};
