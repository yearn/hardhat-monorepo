import { BigNumber } from '@ethersproject/bignumber';
import { ethers } from 'hardhat';
import { constants } from 'ethers';
import { BaseDexLibrary, DexLibrary, DexLibrarySwapProps, DexLibrarySwapResponse } from '../types';
import { IUniswapV2Factory, IUniswapV2Factory__factory, IUniswapV2Router02, IUniswapV2Router02__factory } from '@typechained';
import { UNISWAP_V2_FACTORY, UNISWAP_V2_ROUTER } from '@deploy/mainnet-swappers/uniswap_v2';
import { SUSHISWAP_FACTORY, SUSHISWAP_ROUTER } from '@deploy/common-swappers/sushiswap';
import { SPOOKYSWAP_FACTORY, SPOOKYSWAP_ROUTER } from '@deploy/fantom-swappers/spookyswap';
import { SPIRITSWAP_FACTORY, SPIRITSWAP_ROUTER } from '@deploy/fantom-swappers/spiritswap';

export class UniswapLibrary extends BaseDexLibrary implements DexLibrary {
  protected _router!: IUniswapV2Router02;
  protected _factory!: IUniswapV2Factory;

  protected async init(): Promise<void> {
    this._factory = await ethers.getContractAt<IUniswapV2Factory>(IUniswapV2Factory__factory.abi, UNISWAP_V2_FACTORY[this._network.chainId]);
    this._router = await ethers.getContractAt<IUniswapV2Router02>(IUniswapV2Router02__factory.abi, UNISWAP_V2_ROUTER[this._network.chainId]);
  }

  async swap({ tokenIn, amountIn, tokenOut }: DexLibrarySwapProps): Promise<DexLibrarySwapResponse> {
    // TODO: Add hop tokens logic
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
      dex: 'uniswap',
      unsignedSwapTx: await this._router.populateTransaction.factory(), // MOCKED
      swapperData: ethers.utils.defaultAbiCoder.encode(['address[]'], [maxPath]),
      amountOut: maxOut,
      path: maxPath,
    };
  }
}

export class SushiswapLibrary extends UniswapLibrary {
  protected async _loadContracts(): Promise<void> {
    this._factory = await ethers.getContractAt<IUniswapV2Factory>(IUniswapV2Factory__factory.abi, SUSHISWAP_FACTORY[this._network.chainId]);
    this._router = await ethers.getContractAt<IUniswapV2Router02>(IUniswapV2Router02__factory.abi, SUSHISWAP_ROUTER[this._network.chainId]);
  }

  async swap(props: DexLibrarySwapProps): Promise<DexLibrarySwapResponse> {
    const response = await super.swap(props);
    response.dex = 'sushiswap';
    return response;
  }
}

export class SpookyswapLibrary extends UniswapLibrary {
  protected async _loadContracts(): Promise<void> {
    this._factory = await ethers.getContractAt<IUniswapV2Factory>(IUniswapV2Factory__factory.abi, SPOOKYSWAP_FACTORY);
    this._router = await ethers.getContractAt<IUniswapV2Router02>(IUniswapV2Router02__factory.abi, SPOOKYSWAP_ROUTER);
  }

  async swap(props: DexLibrarySwapProps): Promise<DexLibrarySwapResponse> {
    const response = await super.swap(props);
    response.dex = 'spookyswap';
    return response;
  }
}

export class SpiritswapLibrary extends UniswapLibrary {
  protected async _loadContracts(): Promise<void> {
    this._factory = await ethers.getContractAt<IUniswapV2Factory>(IUniswapV2Factory__factory.abi, SPIRITSWAP_FACTORY);
    this._router = await ethers.getContractAt<IUniswapV2Router02>(IUniswapV2Router02__factory.abi, SPIRITSWAP_ROUTER);
  }

  async swap(props: DexLibrarySwapProps): Promise<DexLibrarySwapResponse> {
    const response = await super.swap(props);
    response.dex = 'spiritswap';
    return response;
  }
}
