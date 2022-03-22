import { BigNumber } from '@ethersproject/bignumber';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import qs from 'qs';
import { IERC20Metadata } from '../../../typechained';
import { abi as IERC20MetadataABI } from '@artifacts/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol/IERC20Metadata.json';
import { BaseDexLibrary, DexLibrary, DexLibrarySwapProps, DexLibrarySwapResponse } from '../types';
import { ethers } from 'hardhat';

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

export class ZrxLibrary extends BaseDexLibrary implements DexLibrary {
  async swap({ tokenIn, amountIn, tokenOut }: DexLibrarySwapProps): Promise<DexLibrarySwapResponse> {
    const [tokenInContract, tokenOutContract] = await Promise.all([
      ethers.getContractAt<IERC20Metadata>(IERC20MetadataABI, tokenIn),
      ethers.getContractAt<IERC20Metadata>(IERC20MetadataABI, tokenOut),
    ]);
    const quoteRequest: QuoteRequest = {
      sellToken: tokenIn,
      buyToken: tokenOut,
      sellAmount: amountIn.toString(),
      chainId: this._network.chainId,
      excludeSources: ['Mesh'],
    };
    try {
      const response = await axios.get(`https://${API_URL[quoteRequest.chainId]}/swap/v1/quote?${qs.stringify(quoteRequest)}`);
      const quoteResponse = response.data as QuoteResponse;
      return {
        dex: 'zrx',
        unsignedSwapTx: await tokenInContract.populateTransaction.decimals(), // MOCKED
        swapperData: quoteResponse.data,
        swapperAddress: '',
        amountOut: BigNumber.from(quoteResponse.buyAmount),
        path: [tokenIn, tokenOut],
      };
    } catch (err: any) {
      const code = err.response ? err.response.data.code : err.code;
      throw new Error(`Error code: ${code}. Reason: ${err.response?.data.reason}`);
    }
  }
}
