import { BigNumber } from '@ethersproject/bignumber';
import { ethers } from 'hardhat';
import { constants } from 'ethers';
import { BaseDexLibrary, DexLibrary, DexLibrarySwapProps, DexLibrarySwapResponse } from '../types';
import { IUniswapV2Factory, IUniswapV2Factory__factory, IUniswapV2Router02, IUniswapV2Router02__factory } from '@typechained';

// export type SwapParams = {
//   tokenIn: string;
//   tokenOut: string;
//   amountIn: BigNumber;
//   uniswapV2Router: string;
//   uniswapV2Factory: string;
//   hopTokensToTest?: string[];
//   slippage?: number;
// };

// export type SwapResponse = {
//   data: string;
//   amountOut: BigNumber;
//   minAmountOut?: BigNumber;
//   path: string[];
// };

// export const getBestPathEncoded = async (swapParams: SwapParams): Promise<SwapResponse> => {
//   swapParams.hopTokensToTest = swapParams.hopTokensToTest ?? [];

//   const factory = await ethers.getContractAt(IUniswapV2Factory, swapParams.uniswapV2Factory);
//   const router = await ethers.getContractAt(IUniswapV2Router02, swapParams.uniswapV2Router);

//   let maxPath: string[] = [];
//   let maxOut: BigNumber = BigNumber.from('0');

//   if ((await factory.getPair(swapParams.tokenIn, swapParams.tokenOut)) != constants.AddressZero) {
//     maxPath = [swapParams.tokenIn, swapParams.tokenOut];
//     [, maxOut] = await router.getAmountsOut(swapParams.amountIn, maxPath);
//   }

//   for (let i = 0; i < swapParams.hopTokensToTest.length; i++) {
//     if (
//       (await factory.getPair(swapParams.tokenIn, swapParams.hopTokensToTest[i])) != constants.AddressZero &&
//       (await factory.getPair(swapParams.hopTokensToTest[i], swapParams.tokenOut)) != constants.AddressZero
//     ) {
//       const hopPath = [swapParams.tokenIn, swapParams.hopTokensToTest[i], swapParams.tokenOut];
//       const amountsOut = await router.getAmountsOut(swapParams.amountIn, hopPath);
//       const hopOut = amountsOut[amountsOut.length - 1];
//       if (hopOut.gt(maxOut)) {
//         maxOut = hopOut;
//         maxPath = hopPath;
//       }
//     }
//   }
//   const response: SwapResponse = {
//     data: ethers.utils.defaultAbiCoder.encode(['address[]'], [maxPath]),
//     amountOut: maxOut,
//     path: maxPath,
//   };

//   if (swapParams.hasOwnProperty('slippage')) {
//     response.minAmountOut = maxOut.sub(maxOut.mul(swapParams.slippage!).div(100));
//   }

//   return response;
// };

// export default {
//   getBestPathEncoded,
// };

export class UniswapLibrary extends BaseDexLibrary implements DexLibrary {
  private _router!: IUniswapV2Router02;
  private _factory!: IUniswapV2Factory;

  protected async _loadContracts(): Promise<void> {
    let routerAddress: string;
    let factoryAddress: string;
    // if(true == true) { // compare chain id === 1
    routerAddress = '0xmain';
    factoryAddress = '0xmain';
    // }
    this._factory = await ethers.getContractAt<IUniswapV2Factory>(IUniswapV2Factory__factory.abi, factoryAddress);
    this._router = await ethers.getContractAt<IUniswapV2Router02>(IUniswapV2Router02__factory.abi, routerAddress);
  }

  async swap({ tokenIn, amountIn, tokenOut }: DexLibrarySwapProps): Promise<DexLibrarySwapResponse> {
    const hopTokens: string[] = [];
    let maxPath: string[] = [];
    let maxOut: BigNumber = BigNumber.from('0');

    if ((await this._factory.getPair(tokenIn, tokenOut)) != constants.AddressZero) {
      maxPath = [tokenIn, tokenOut];
      [, maxOut] = await this._router.getAmountsOut(amountIn, maxPath);
    }

    for (let i = 0; i < hopTokens.length; i++) {
      if (
        (await this._factory.getPair(tokenIn, hopTokens[i])) != constants.AddressZero &&
        (await this._factory.getPair(hopTokens[i], tokenOut)) != constants.AddressZero
      ) {
        const hopPath = [tokenIn, hopTokens[i], tokenOut];
        const amountsOut = await this._router.getAmountsOut(amountIn, hopPath);
        const hopOut = amountsOut[amountsOut.length - 1];
        if (hopOut.gt(maxOut)) {
          maxOut = hopOut;
          maxPath = hopPath;
        }
      }
    }

    return {
      swapTransactionData: '',
      data: ethers.utils.defaultAbiCoder.encode(['address[]'], [maxPath]),
      amountOut: maxOut,
      path: maxPath,
    };
  }
}
