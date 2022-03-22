import { SDK as BancorSDK } from '@bancor/sdk';
import { BlockchainType } from '@bancor/sdk/dist/types';
import { SUPPORTED_NETWORKS } from '@yearn/commons/utils/network';
import { abi as IERC20MetadataABI } from '@artifacts/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol/IERC20Metadata.json';
import { IERC20Metadata } from '@typechained';
import { getNodeUrl } from '@utils/network';
import { utils } from 'ethers';
import { ethers } from 'hardhat';
import { BaseDexLibrary, DexLibrary, DexLibrarySwapProps, DexLibrarySwapResponse } from '../types';

export class BancorLibrary extends BaseDexLibrary implements DexLibrary {
  protected _bancorSDK!: BancorSDK;

  protected async init(): Promise<void> {
    this._bancorSDK = await BancorSDK.create({
      ethereumNodeEndpoint: getNodeUrl(this._network.name as SUPPORTED_NETWORKS),
    });
  }

  async swap({ tokenIn, amountIn, tokenOut }: DexLibrarySwapProps): Promise<DexLibrarySwapResponse> {
    const [tokenInContract, tokenOutContract] = await Promise.all([
      ethers.getContractAt<IERC20Metadata>(IERC20MetadataABI, tokenIn),
      ethers.getContractAt<IERC20Metadata>(IERC20MetadataABI, tokenOut),
    ]);
    const [decimalsIn, decimalsOut] = await Promise.all([tokenInContract.decimals(), tokenOutContract.decimals()]);
    const pathAndRate = await this._bancorSDK.pricing.getPathAndRate(
      {
        blockchainType: BlockchainType.Ethereum,
        blockchainId: tokenIn,
      },
      {
        blockchainType: BlockchainType.Ethereum,
        blockchainId: tokenOut,
      },
      utils.formatUnits(amountIn, decimalsIn)
    );
    const simpleAmountOut = await this._bancorSDK.pricing.getRateByPath(pathAndRate.path, utils.formatEther(amountIn));
    const amountOut = utils.parseUnits(Number(simpleAmountOut).toFixed(decimalsOut), decimalsOut);
    const path = pathAndRate.path.map((step) => step.blockchainId);
    return {
      dex: 'bancor',
      unsignedSwapTx: await tokenInContract.populateTransaction.decimals(), // MOCKED
      swapperData: ethers.utils.defaultAbiCoder.encode(['address[]'], [path]),
      amountOut,
      path,
    };
  }
}
