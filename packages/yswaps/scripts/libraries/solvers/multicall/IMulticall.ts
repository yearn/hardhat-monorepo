import { EnabledTrade, TradeSetup } from '@scripts/types';

export interface IMulticall {
  match(trade: EnabledTrade): boolean;
  asyncSwap(trade: EnabledTrade): Promise<TradeSetup>;
}
