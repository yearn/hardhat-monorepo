import {PendingTrade} from '../types';

export interface IHook {
    match(trade: PendingTrade): boolean;
    preSwap(trade: PendingTrade): void;
    postSwap(trade: PendingTrade): void;
}


