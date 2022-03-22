import { BigNumber } from '@ethersproject/bignumber';
import { ethers } from 'hardhat';
import { constants } from 'ethers';
import { ISolidlyFactory, ISolidlyFactory__factory, ISolidlyRouter, ISolidlyRouter__factory } from '@typechained';
import { BaseDexLibrary, DexLibrary, DexLibrarySwapProps, DexLibrarySwapResponse } from '../types';
import { SOLIDLY_FACTORY, SOLIDLY_ROUTER } from '@deploy/fantom-swappers/solidly';

export class SolidlyLibrary extends BaseDexLibrary implements DexLibrary {
  protected _router!: ISolidlyRouter;
  protected _factory!: ISolidlyFactory;

  protected async init(): Promise<void> {
    this._factory = await ethers.getContractAt<ISolidlyFactory>(ISolidlyFactory__factory.abi, SOLIDLY_FACTORY);
    this._router = await ethers.getContractAt<ISolidlyRouter>(ISolidlyRouter__factory.abi, SOLIDLY_ROUTER);
  }

  async swap({ tokenIn, amountIn, tokenOut }: DexLibrarySwapProps): Promise<DexLibrarySwapResponse> {
    // TODO: Add hop tokens logic
    const hopTokensToTest: string[] = [];

    let maxPath: ISolidlyRouter.RouteStruct[] = [];
    let maxOut: BigNumber = BigNumber.from('0');

    if ((await this._factory.getPair(tokenIn, tokenOut, true)) != constants.AddressZero) {
      maxPath = [{ from: tokenIn, to: tokenOut, stable: true }];
      [, maxOut] = await this._router.getAmountsOut(amountIn, maxPath);
    }

    if ((await this._factory.getPair(tokenIn, tokenOut, false)) != constants.AddressZero) {
      const notStablePath = [{ from: tokenIn, to: tokenOut, stable: false }];
      const [, notStableOut] = await this._router.getAmountsOut(amountIn, notStablePath);
      if (notStableOut.gt(maxOut)) {
        maxPath = notStablePath;
        maxOut = notStableOut;
      }
    }

    for (const hopToken of hopTokensToTest) {
      // Pairing tokenIn and tokenOut with hopToken
      const tokenInStablePair = await this._factory.getPair(tokenIn, hopToken, true);
      const tokenInVolatilePair = await this._factory.getPair(tokenIn, hopToken, false);
      const tokenOutStablePair = await this._factory.getPair(hopToken, tokenOut, true);
      const tokenOutVolatilePair = await this._factory.getPair(hopToken, tokenOut, false);

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
          const [, , amountOut] = await this._router.getAmountsOut(amountIn, path);
          if (amountOut.gt(maxOut)) {
            maxOut = amountOut;
            maxPath = path;
          }
        }
      }
    }

    // Parse max path to tuple-style array
    const pathMap = maxPath.map((path) => Object.values(path));

    // Parse max path to real path of addresses being used
    const pathAddresses: string[] = maxPath.map((path) => path.from);
    pathAddresses.push(maxPath[maxPath.length - 1].to);
    return {
      dex: 'solidly',
      unsignedSwapTx: await this._router.populateTransaction.factory(), // MOCKED
      swapperData: ethers.utils.defaultAbiCoder.encode(['tuple(address, address, bool)[]'], [[...pathMap]]),
      amountOut: maxOut,
      path: pathAddresses,
    };
  }
}
