import { ethers } from 'hardhat';

async function main() {
  const strategyToAdd = '';
  const tradeFactory = await ethers.getContract('TradeFactory');
  await tradeFactory.grantRole(await tradeFactory.STRATEGY(), strategyToAdd);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
