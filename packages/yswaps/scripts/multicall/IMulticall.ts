import { PendingTrade, TradeSetup } from '../types';

export interface IMulticall {
  match(trade: PendingTrade): boolean;
  asyncSwap(trade: PendingTrade): Promise<TradeSetup>;
}
