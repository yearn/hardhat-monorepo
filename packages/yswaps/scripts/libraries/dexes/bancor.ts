import { SDK as BancorSDK } from '@bancor/sdk';
import { BlockchainType } from '@bancor/sdk/dist/types';
import { BigNumber } from '@ethersproject/bignumber';
import { abi as IERC20MetadataABI } from '@artifacts/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol/IERC20Metadata.json';
import { IERC20Metadata } from '@typechained';
import { getNodeUrl } from '@utils/network';
import { utils } from 'ethers';
import { ethers } from 'hardhat';

export type SwapParams = {
  tokenIn: string;
  tokenOut: string;
  amountIn: BigNumber;
  slippage: number;
};

export type SwapResponse = {
  data: string;
  amountOut: BigNumber;
  minAmountOut?: BigNumber;
  path: string[];
};

export const swap = async ({ tokenIn, tokenOut, amountIn, slippage }: SwapParams): Promise<SwapResponse> => {
  const bancorSDK = await BancorSDK.create({
    ethereumNodeEndpoint: getNodeUrl('mainnet'),
  });
  const pathAndRate = await bancorSDK.pricing.getPathAndRate(
    {
      blockchainType: BlockchainType.Ethereum,
      blockchainId: tokenIn,
    },
    {
      blockchainType: BlockchainType.Ethereum,
      blockchainId: tokenOut,
    },
    utils.formatEther(amountIn)
  );
  const simpleAmountOut = await bancorSDK.pricing.getRateByPath(pathAndRate.path, utils.formatEther(amountIn));
  const tokenTo = (await ethers.getContractAt(IERC20MetadataABI, tokenOut)) as IERC20Metadata;
  const decimalsOut = await tokenTo.decimals();
  const amountOut = utils.parseUnits(Number(simpleAmountOut).toFixed(decimalsOut), decimalsOut);
  const minAmountOut = amountOut.sub(amountOut.mul(slippage).div(100));
  const path = pathAndRate.path.map((step) => step.blockchainId);
  return {
    data: ethers.utils.defaultAbiCoder.encode(['address[]'], [path]),
    amountOut,
    minAmountOut,
    path,
  };
};

export default {
  swap,
};
