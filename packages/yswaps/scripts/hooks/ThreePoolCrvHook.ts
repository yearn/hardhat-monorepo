import { PopulatedTransaction } from 'ethers';
import { PendingTrade } from '@scripts/types';
import { IHook } from './IHook';
// import { fork as ethers } from './fork';
export class ThreePoolCrvHook implements IHook {

    match(trade: PendingTrade) {
        return true;
    }

    preSwap(trade: PendingTrade): PopulatedTransaction[] {
        // withdraw 3crv
        // ethers.

        return [];
    }

    postSwap(trade: PendingTrade): PopulatedTransaction[] {

        return [];
    }
}
