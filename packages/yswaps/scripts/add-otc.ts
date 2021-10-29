import { run, ethers } from 'hardhat';

async function main() {
  const otcPool = await ethers.getContract('OTCPool');
  const tradeFactory = await ethers.getContract('TradeFactory');
  await tradeFactory.setOTCPool(otcPool.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
