import { ethers, getChainId } from 'hardhat';
import sleep from 'sleep-promise';
import uniswap from '@libraries/uniswap-v2';
import moment from 'moment';
import { SPOOKYSWAP_FACTORY, SPOOKYSWAP_ROUTER, WETH, WFTM } from '@deploy/fantom-swappers/spookyswap';
import { SPIRITSWAP_FACTORY, SPIRITSWAP_ROUTER } from '@deploy/fantom-swappers/spiritswap';
import { utils } from 'ethers';

const SPOOKY_TOKEN = '0x841fad6eae12c286d1fd18d1d525dffa75c7effe';
const SPIRIT_TOKEN = '0x5cc61a78f164885776aa610fb0fe1257df78e59b';

async function main() {
  const chainId = await getChainId();
  console.log('Chain ID:', chainId);
  const tradeFactory = await ethers.getContract('TradeFactory');
  const spookyswapSwapper = await ethers.getContract('AsyncSpookyswap');
  const spiritswapSwapper = await ethers.getContract('AsyncSpiritswap');
  const pendingTradesIds = await tradeFactory['pendingTradesIds()']();
  const pendingTrades: any = [];
  for (const id of pendingTradesIds) {
    pendingTrades.push(await tradeFactory['pendingTradesById(uint256)'](id));
  }
  for (const pendingTrade of pendingTrades) {
    let data;
    if (pendingTrade._deadline.lt(moment().unix())) {
      console.log(`Expiring trade ${pendingTrade._id.toString()}`);
      await tradeFactory.expire(pendingTrade._id);
      continue;
    }

    if (compareAddresses(pendingTrade._swapper, spookyswapSwapper.address)) {
      console.log(`Executing ${pendingTrade._id.toString()} through Spookyswap`);
      ({ data } = await uniswap.getBestPathEncoded({
        tokenIn: pendingTrade._tokenIn,
        tokenOut: pendingTrade._tokenOut,
        amountIn: pendingTrade._amountIn,
        uniswapV2Router: SPOOKYSWAP_ROUTER,
        uniswapV2Factory: SPOOKYSWAP_FACTORY,
        hopTokensToTest: [SPOOKY_TOKEN, WFTM, WETH],
      }));
    } else if (compareAddresses(pendingTrade._swapper, spiritswapSwapper.address)) {
      console.log(`Executing ${pendingTrade._id.toString()} through Spiritswap`);
      ({ data } = await uniswap.getBestPathEncoded({
        tokenIn: pendingTrade._tokenIn,
        tokenOut: pendingTrade._tokenOut,
        amountIn: pendingTrade._amountIn,
        uniswapV2Router: SPIRITSWAP_ROUTER,
        uniswapV2Factory: SPIRITSWAP_FACTORY,
        hopTokensToTest: [SPIRIT_TOKEN, WFTM, WETH],
      }));
    }
    await tradeFactory['execute(uint256,bytes)'](pendingTrade._id, data, { gasLimit: 8_000_000 });
    await sleep(5000);
  }
}

const compareAddresses = (str1: string, str2: string): boolean => str1.toLowerCase() === str2.toLowerCase();

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
