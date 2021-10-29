import { ethers } from 'hardhat';

async function main() {
  const strategy = '';
  const syncSwapper = '';
  const tradeFactory = await ethers.getContract('TradeFactory');
  await tradeFactory.setStrategySyncSwapper(strategy, syncSwapper);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
