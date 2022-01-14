import { ethers } from 'hardhat';
import moment from 'moment';
import { utils } from 'ethers';
import { TradeFactory } from '@typechained';
import * as gasprice from './libraries/gasprice';
import { PendingTrade } from './types';

const DELAY = moment.duration('8', 'minutes').as('milliseconds');
const MAX_GAS_PRICE = utils.parseUnits('300', 'gwei');
const FLASHBOT_MAX_PRIORITY_FEE_PER_GAS = 4;
const MAX_PRIORITY_FEE_PER_GAS = utils.parseUnits('6', 'gwei');

async function main() {
  await gasprice.start();

  const [ymech] = await ethers.getSigners();

  console.log('[Setup] Executing with address', ymech.address);

  const tradeFactory: TradeFactory = await ethers.getContract('TradeFactory');
  const pendingTradesIds = await tradeFactory['pendingTradesIds()']();
  const pendingTrades: PendingTrade[] = [];

  for (const id of pendingTradesIds) {
    pendingTrades.push(await tradeFactory.pendingTradesById(id));
  }

  for (const pendingTrade of pendingTrades) {
    if (pendingTrade._deadline.lt(moment().unix())) {
      console.log(`[Executing] Expiring trade ${pendingTrade._id.toString()}`);
      await tradeFactory.expire(pendingTrade._id);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
