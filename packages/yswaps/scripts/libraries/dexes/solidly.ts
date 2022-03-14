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
  hopTokensToTest?: string[];
  slippage?: number;
};

export type SwapResponse = {
  data: string;
  amountOut: BigNumber;
  minAmountOut?: BigNumber;
  path: ISolidlyRouter.RouteStruct[];
};

export const getBestPathEncoded = async (swapParams: SwapParams): Promise<SwapResponse> => {
  const { tokenIn, tokenOut, amountIn } = swapParams;
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
    const [, notStableOut] = await router.getAmountsOut(swapParams.amountIn, notStablePath);
    if (notStableOut.gt(maxOut)) {
      maxPath = notStablePath;
      maxOut = notStableOut;
    }
  }

  const { bestMaxPath: hopBestMaxPath, bestAmountOut: hopBestAmountOut, bestHopToken } = await hopTokenCalculation({ swapParams });
  if (hopBestAmountOut.gt(maxOut)) {
    console.log(`[Solidly Dex] Using best hop token: ${bestHopToken}`);
    maxPath = hopBestMaxPath;
    maxOut = hopBestAmountOut;
  }

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

async function hopTokenCalculation({ swapParams }: { swapParams: SwapParams }) {
  const { tokenIn, tokenOut, hopTokensToTest, amountIn } = swapParams;
  const factory = await ethers.getContractAt<ISolidlyFactory>(ISolidlyFactory__factory.abi, swapParams.solidlyFactory);
  const router = await ethers.getContractAt<ISolidlyRouter>(ISolidlyRouter__factory.abi, swapParams.solidlyRouter);

  let bestMaxPath: ISolidlyRouter.RouteStruct[] = [];
  let bestAmountOut: BigNumber = BigNumber.from('0');
  let bestHopToken: string = '';
  if (!hopTokensToTest) return { bestMaxPath, bestAmountOut, bestHopToken };

  for (const hopToken of hopTokensToTest) {
    // Pairing tokenIn and tokenOut with hopToken
    const tokenInStablePair = await factory.getPair(tokenIn, hopToken, true);
    const tokenInVolatilePair = await factory.getPair(tokenIn, hopToken, false);
    const tokenOutStablePair = await factory.getPair(hopToken, tokenOut, true);
    const tokenOutVolatilePair = await factory.getPair(hopToken, tokenOut, false);

    const pairOptions = [
      {
        pairIn: tokenInStablePair,
        pairOut: tokenOutStablePair,
        path: [
          { from: tokenIn, to: hopToken, stable: true },
          { from: hopToken, to: tokenOut, stable: true },
        ],
      },
      {
        pairIn: tokenInVolatilePair,
        pairOut: tokenOutVolatilePair,
        path: [
          { from: tokenIn, to: hopToken, stable: false },
          { from: hopToken, to: tokenOut, stable: false },
        ],
      },
      {
        pairIn: tokenInStablePair,
        pairOut: tokenOutVolatilePair,
        path: [
          { from: tokenIn, to: hopToken, stable: true },
          { from: hopToken, to: tokenOut, stable: false },
        ],
      },
      {
        pairIn: tokenInVolatilePair,
        pairOut: tokenOutStablePair,
        path: [
          { from: tokenIn, to: hopToken, stable: false },
          { from: hopToken, to: tokenOut, stable: true },
        ],
      },
    ];

    for (const pairOption of pairOptions) {
      const { pairIn, pairOut, path } = pairOption;
      if (pairIn != constants.AddressZero && pairOut != constants.AddressZero) {
        const [, , amountOut] = await router.getAmountsOut(amountIn, path);
        if (amountOut.gt(bestAmountOut)) {
          bestAmountOut = amountOut;
          bestMaxPath = path;
          bestHopToken = hopToken;
        }
      }
    }
  }

  return { bestMaxPath, bestAmountOut, bestHopToken };
}

export default {
  getBestPathEncoded,
};
