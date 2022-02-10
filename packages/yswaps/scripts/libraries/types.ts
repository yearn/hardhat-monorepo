import { BigNumber, PopulatedTransaction } from 'ethers';
import { ITradeFactoryPositionsHandler, TradeFactory } from '@typechained';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

export type TradeSetup = {
  swapperName: string;
  transaction: PopulatedTransaction;
};

export type ExtendedEnabledTrade = ITradeFactoryPositionsHandler.EnabledTradeStruct & {
  _tokenIn: string | string[];
  _slippage?: number;
};

export interface IMulticallSolver extends Solver {
  match(trade: ExtendedEnabledTrade): boolean;
}

export abstract class Solver {
  abstract solve(trade: ExtendedEnabledTrade, tradeFactory: TradeFactory): Promise<TradeSetup>;
}
