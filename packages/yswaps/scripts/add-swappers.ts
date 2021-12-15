import { ethers } from 'hardhat';

async function main() {
  const tradeFactory = await ethers.getContract('TradeFactory');
  const oneInchAggregator = await ethers.getContract('OneInchAggregator');
  const asyncSushiswap = await ethers.getContract('AsyncSushiswap');
  await tradeFactory.addSwappers([oneInchAggregator.address, asyncSushiswap.address]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
