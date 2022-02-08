import { EnabledTrade, TradeSetup } from '../types';

export interface IMulticall {
  match(trade: EnabledTrade): boolean;
  asyncSwap(trade: EnabledTrade): Promise<TradeSetup>;
}
