import { ethers, getChainId } from 'hardhat';
import zrx from '@libraries/zrx';
import oneinch from '@libraries/oneinch';
import * as wallet from '@test-utils/wallet';
import moment from 'moment';

async function main() {
  const chainId = await getChainId();
  console.log('Chain ID:', chainId);
  const tradeFactory = await ethers.getContract('TradeFactory');
  const ZRXSwapper = await ethers.getContract('ZRXSwapper');
  const oneInchAggregatorSwapper = await ethers.getContract('OneInchAggregatorSwapper');
  const pendingTradesIds = await tradeFactory['pendingTradesIds()']();
  const pendingTrades: any = [];
  for (const id of pendingTradesIds) {
    pendingTrades.push(await tradeFactory['pendingTradesById(uint256)'](id));
  }
  console.log(`There are ${pendingTrades.length} pending trades`);
  for (const pendingTrade of pendingTrades) {
    let data;
    if (pendingTrade._deadline.lt(moment().unix())) {
      console.log(`Expiring trade ${pendingTrade._id.toString()}`);
      await tradeFactory.expire(pendingTrade._id);
      continue;
    }
    if (compareAddresses(pendingTrade._swapper, ZRXSwapper.address)) {
      console.log(`Executing ${pendingTrade._id.toString()} through ZRX`);
      const zrxAPIResponse = await zrx.quote({
        chainId: Number(chainId),
        sellToken: pendingTrade._tokenIn,
        buyToken: pendingTrade._tokenOut,
        sellAmount: pendingTrade._amountIn,
        sippagePercentage: 0.05,
        skipValidation: true,
      });
      data = zrxAPIResponse.data;
    } else if (compareAddresses(pendingTrade._swapper, oneInchAggregatorSwapper.address)) {
      console.log(`Executing ${pendingTrade._id.toString()} through ONE INCH`);
      const oneInchApiResponse = await oneinch.swap(Number(chainId), {
        tokenIn: pendingTrade._tokenIn,
        tokenOut: pendingTrade._tokenOut,
        amountIn: pendingTrade._amountIn,
        fromAddress: wallet.generateRandomAddress(),
        receiver: pendingTrade._strategy,
        slippage: 3,
        allowPartialFill: false,
        disableEstimate: true,
        fee: 0,
        gasLimit: 8_000_000,
      });
      data = oneInchApiResponse.tx.data;
    }
    await tradeFactory['execute(uint256,bytes)'](pendingTrade._id, data, { gasLimit: 8_000_000 });
  }
}

const compareAddresses = (str1: string, str2: string): boolean => str1.toLowerCase() === str2.toLowerCase();

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
