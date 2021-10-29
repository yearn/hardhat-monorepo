import { ethers, getChainId } from 'hardhat';
import { abi as IERC20ABI } from '../artifacts/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol/IERC20Metadata.json';
import { SPOOKYSWAP_FACTORY, SPOOKYSWAP_ROUTER, WETH, WFTM } from '../deploy/fantom-swappers/spookyswap';
import { SPIRITSWAP_FACTORY, SPIRITSWAP_ROUTER } from '../deploy/fantom-swappers/spiritswap';
import { BigNumber, utils } from 'ethers';
import uniswap from './libraries/uniswap-v2';

const SPOOKY_TOKEN = '0x841fad6eae12c286d1fd18d1d525dffa75c7effe';
const SPIRIT_TOKEN = '0x5cc61a78f164885776aa610fb0fe1257df78e59b';

const otcTradesIds = [4];

async function main() {
  const chainId = await getChainId();
  console.log('Chain ID:', chainId);
  const tradeFactory = await ethers.getContract('TradeFactory');
  const otcPool = await ethers.getContract('OTCPool');
  const otcPoolBalances: { [token: string]: BigNumber } = {};
  const otcTrades: any = [];
  for (const id of otcTradesIds) {
    const otcTrade = await tradeFactory['pendingTradesById(uint256)'](id);
    if (!otcPoolBalances.hasOwnProperty(otcTrade._tokenOut)) {
      otcPoolBalances[otcTrade._tokenOut] = await otcPool.offers(otcTrade._tokenOut);
    }
    otcTrades.push(otcTrade);
  }
  console.log('-------------');
  console.log('OTCPool offers');
  for (const otcPoolOfferedToken of Object.keys(otcPoolBalances)) {
    const token = await ethers.getContractAt(IERC20ABI, otcPoolOfferedToken);
    console.log(`${utils.formatUnits(otcPoolBalances[otcPoolOfferedToken], await token.decimals())} ${await token.symbol()}`);
  }
  console.log('-------------');
  console.log('Using rates');
  const rates: BigNumber[] = [];
  for (const otcTrade of otcTrades) {
    let spookyswapOut, spiritswapOut;
    const tokenOut = await ethers.getContractAt(IERC20ABI, otcTrade._tokenOut);
    const tokenIn = await ethers.getContractAt(IERC20ABI, otcTrade._tokenIn);
    const magnitudeIn = BigNumber.from('10').pow(await tokenIn.decimals());

    ({ amountOut: spookyswapOut } = await uniswap.getBestPathEncoded({
      tokenIn: otcTrade._tokenIn,
      tokenOut: otcTrade._tokenOut,
      amountIn: magnitudeIn,
      uniswapV2Router: SPOOKYSWAP_ROUTER,
      uniswapV2Factory: SPOOKYSWAP_FACTORY,
      hopTokensToTest: [SPOOKY_TOKEN, WFTM, WETH],
    }));

    ({ amountOut: spiritswapOut } = await uniswap.getBestPathEncoded({
      tokenIn: otcTrade._tokenIn,
      tokenOut: otcTrade._tokenOut,
      amountIn: magnitudeIn,
      uniswapV2Router: SPIRITSWAP_ROUTER,
      uniswapV2Factory: SPIRITSWAP_FACTORY,
      hopTokensToTest: [SPIRIT_TOKEN, WFTM, WETH],
    }));

    const ratePerTokenInToOut = spookyswapOut.gt(spiritswapOut) ? spookyswapOut : spiritswapOut;

    const amountOut = otcTrade._amountIn.mul(ratePerTokenInToOut).div(magnitudeIn);

    if (amountOut.gt(otcPoolBalances[otcTrade._tokenOut])) throw new Error('Liquidity missing on otc pool');

    otcPoolBalances[otcTrade._tokenOut] = otcPoolBalances[otcTrade._tokenOut].sub(amountOut);

    rates.push(ratePerTokenInToOut);

    console.log(`${await tokenIn.symbol()} => ${await tokenOut.symbol()}: ${utils.formatUnits(ratePerTokenInToOut, await tokenOut.decimals())}`);
  }
  console.log('-------------');
  const tx = await tradeFactory['execute(uint256[],uint256)'](otcTradesIds, rates[0]);
  console.log('tx hash', tx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
