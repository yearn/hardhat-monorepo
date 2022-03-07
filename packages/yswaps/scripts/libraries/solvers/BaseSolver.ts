import { JsonRpcSigner } from '@ethersproject/providers';
import { BaseContract, BigNumber, constants, Contract, PopulatedTransaction, Signer, utils } from 'ethers';
import { ICurveFi, ICurveFi__factory, IERC20, IERC20__factory, IWETH, IWETH__factory, TradeFactory } from '@typechained';
import zrx from '@libraries/dexes/zrx';
import { mergeTransactions } from '@scripts/libraries/utils/multicall';
import { impersonate } from '@test-utils/wallet';
import { SimpleEnabledTrade, Solver } from '@scripts/libraries/types';
import { ethers } from 'hardhat';
import { Network } from '@ethersproject/networks';
import { ITradeFactoryExecutor } from '@typechained';

export class BaseSolver {
  protected _name: string;
  protected _network: Network;
  private _contracts: Map<string, Contract>;

  constructor({ name, network }: { name: string; network: Network }) {
    this._name = name;
    this._network = network;
    this._contracts = new Map();
  }

  public static async init({ name, network }: { name: string; network: Network }): Promise<BaseSolver> {
    const solverInstance = new BaseSolver({ name, network });
    await solverInstance._loadSigners();
    await solverInstance._loadContracts();
    return solverInstance;
  }

  protected async _loadSigners(): Promise<void> {}

  protected async _loadContracts(): Promise<void> {}

  async shouldExecuteTrade({ strategy, trades }: { strategy: string; trades: SimpleEnabledTrade[] }): Promise<boolean> {
    for (let i = 0; i < trades.length; i++) {
      const tokenContract = await this._getTokenContract({ tokenContractAddress: trades[i].tokenIn });
      const tokenBalance = await tokenContract.balanceOf(strategy);
      if (tokenBalance.lt(0)) return false;
    }
    return true;
  }

  protected async _getTokenContract({
    tokenContractAddress,
    signer,
  }: {
    tokenContractAddress: string;
    signer?: JsonRpcSigner;
  }): Promise<IERC20> {
    return this._getContract({
      contractAddress: tokenContractAddress,
      abi: IERC20__factory.abi,
      signer,
    });
  }

  protected async _getContract<T>({
    contractAddress,
    abi,
    signer,
  }: {
    contractAddress: string;
    abi?: string | any[];
    signer?: JsonRpcSigner;
  }): Promise<T> {
    let contract = this._contracts.get(contractAddress);
    if (!contract) {
      if (!abi) throw new Error('No contract found, need abi to define contract');
      contract = await ethers.getContractAt(abi, contractAddress);
      if (signer) contract = contract.connect(signer);
      this._contracts.set(contractAddress, contract);
    }
    return contract as unknown as T;
  }

  protected async _getExecuteTx({
    tradeFactory,
    asyncTradesExecutionDetails,
    swapperAddress,
    data,
  }: {
    tradeFactory: TradeFactory;
    asyncTradesExecutionDetails: ITradeFactoryExecutor.AsyncTradeExecutionDetailsStruct[];
    swapperAddress: string;
    data: string;
  }): Promise<PopulatedTransaction> {
    if (!asyncTradesExecutionDetails.length) throw new Error('None trades should be execute');

    if (asyncTradesExecutionDetails.length == 1) {
      console.log(`[${this._name}] Execute one trade`);
      return await tradeFactory.populateTransaction['execute((address,address,address,uint256,uint256),address,bytes)'](
        asyncTradesExecutionDetails[0],
        swapperAddress,
        data
      );
    }

    console.log(`[${this._name}] Execute multiple trades`);
    return await tradeFactory.populateTransaction['execute((address,address,address,uint256,uint256)[],address,bytes)'](
      asyncTradesExecutionDetails,
      swapperAddress,
      data
    );
  }
}
