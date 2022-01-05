// TODO: Uncomment. This removes expired trades
// if (pendingTrade._deadline.lt(moment().unix())) {
//   console.log(`Expiring trade ${pendingTrade._id.toString()}`);
//   await tradeFactory.expire(pendingTrade._id);
//   continue;
// }
