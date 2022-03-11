import { BigNumber } from '@ethersproject/bignumber';
import { ethers } from 'hardhat';
import { constants, utils } from 'ethers';
import { ISolidlyFactory, ISolidlyFactory__factory, ISolidlyRouter, ISolidlyRouter__factory } from '@typechained';

export type SwapParams = {
  tokenIn: string;
  tokenOut: string;
  amountIn: BigNumber;
  solidlyFactory: string;
  solidlyRouter: string;
  hopTokensToTest?: ISolidlyRouter.RouteStruct[];
  slippage?: number;
};

export type SwapResponse = {
  data: string;
  amountOut: BigNumber;
  minAmountOut?: BigNumber;
  path: ISolidlyRouter.RouteStruct[];
};

export const getBestPathEncoded = async (swapParams: SwapParams): Promise<SwapResponse> => {
  swapParams.hopTokensToTest = swapParams.hopTokensToTest ?? [];

  const factory = await ethers.getContractAt<ISolidlyFactory>(ISolidlyFactory__factory.abi, swapParams.solidlyFactory);
  const router = await ethers.getContractAt<ISolidlyRouter>(ISolidlyRouter__factory.abi, swapParams.solidlyRouter);

  let maxPath: ISolidlyRouter.RouteStruct[] = [];
  let maxOut: BigNumber = BigNumber.from('0');

  if ((await factory.getPair(swapParams.tokenIn, swapParams.tokenOut, true)) != constants.AddressZero) {
    maxPath = [{ from: swapParams.tokenIn, to: swapParams.tokenOut, stable: true }];
    [, maxOut] = await router.getAmountsOut(swapParams.amountIn, maxPath);
  }

  if ((await factory.getPair(swapParams.tokenIn, swapParams.tokenOut, false)) != constants.AddressZero) {
    const notStablePath = [{ from: swapParams.tokenIn, to: swapParams.tokenOut, stable: false }];
    const [, notStableOut] = await router.getAmountsOut(swapParams.amountIn, maxPath);
    if (notStableOut.gt(maxOut)) maxPath = notStablePath;
  }

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

  const pathMap = maxPath.map((path) => Object.values(path));
  const response: SwapResponse = {
    data: ethers.utils.defaultAbiCoder.encode(['tuple(address, address, bool)[]'], [[...pathMap]]),
    amountOut: maxOut,
    path: maxPath,
  };

  if (swapParams.hasOwnProperty('slippage')) {
    response.minAmountOut = maxOut.sub(maxOut.mul(swapParams.slippage!).div(100));
  }

  return response;
};

export default {
  getBestPathEncoded,
};
