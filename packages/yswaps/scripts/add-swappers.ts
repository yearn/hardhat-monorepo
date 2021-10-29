import { ethers } from 'hardhat';

async function main() {
  const tradeFactory = await ethers.getContract('TradeFactory');
  await tradeFactory.addSwappers([]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
