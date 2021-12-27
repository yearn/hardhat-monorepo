import { BigNumber } from '@ethersproject/bignumber';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import qs from 'qs';
import _ from 'lodash';
import { ethers } from 'hardhat';
import { IERC20Metadata } from '@typechained';
import { abi as IERC20MetadataABI } from '@artifacts/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol/IERC20Metadata.json';
import { utils } from 'ethers';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

const API_URL: { [chainId: number]: string } = {
  1: 'api.0x.org',
  137: 'polygon.api.0x.org',
  250: 'fantom.api.0x.org',
};

export type QuoteRequest = {
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount?: BigNumber | string;
  buyAmount?: BigNumber | string;
  slippagePercentage?: number;
  gasPrice?: BigNumber | string;
  takerAddress?: string;
  excludeSources?: string[] | string;
  includeSources?: string[];
  skipValidation?: boolean;
  intentOnFilling?: boolean;
  buyTokenPercentageFee?: number;
  affiliateAddress?: string;
};

export type QuoteResponse = {
  chainId: number;
  price: string;
  guaranteedPrice: string;
  to: string;
  data: string;
  value: string;
  gas: string;
  estimatedGas: string;
  gasPrice: string;
  protocolFee: string;
  minimumProtocolFee: string;
  buyTokenAddress: string;
  sellTokenAddress: string;
  buyAmount: string;
  sellAmount: string;
  sources: any[];
  orders: any[];
  allowanceTarget: string;
  sellTokenToEthRate: string;
  buyTokenToEthRate: string;
  minAmountOut?: BigNumber;
};

export const quote = async (quoteRequest: QuoteRequest): Promise<QuoteResponse> => {
  if (BigNumber.isBigNumber(quoteRequest.sellAmount)) quoteRequest.sellAmount = quoteRequest.sellAmount.toString();
  if (BigNumber.isBigNumber(quoteRequest.buyAmount)) quoteRequest.buyAmount = quoteRequest.buyAmount.toString();
  if (BigNumber.isBigNumber(quoteRequest.gasPrice)) quoteRequest.gasPrice = quoteRequest.gasPrice.toString();

  quoteRequest.excludeSources = (quoteRequest.excludeSources as string[]) ?? [];
  quoteRequest.excludeSources.push('Mesh');

  quoteRequest.excludeSources = quoteRequest.excludeSources.join(',');

  let response: any;
  let data: QuoteResponse;
  try {
    response = await axios.get(`https://${API_URL[quoteRequest.chainId]}/swap/v1/quote?${qs.stringify(quoteRequest)}`);
    data = response.data as QuoteResponse;
    // Fix for slippage not working as expected
    if (quoteRequest.hasOwnProperty('slippagePercentage')) {
      const tokenFrom = (await ethers.getContractAt(IERC20MetadataABI, quoteRequest.sellToken)) as IERC20Metadata;
      const tokenFromDecimals = await tokenFrom.decimals();
      const tokenTo = (await ethers.getContractAt(IERC20MetadataABI, quoteRequest.buyToken)) as IERC20Metadata;
      const tokenToDecimals = await tokenTo.decimals();
      const rateFromTo = utils.parseUnits(data.guaranteedPrice, tokenToDecimals);
      data.minAmountOut = BigNumber.from(`${data.sellAmount}`).mul(rateFromTo).div(BigNumber.from(10).pow(tokenFromDecimals));
    }
  } catch (err: any) {
    console.log(err.response.data);
    throw new Error(`Error code: ${err.response.data.code}. Reason: ${err.response.data.reason}`);
  }
  return data;
};

export default {
  quote,
};
