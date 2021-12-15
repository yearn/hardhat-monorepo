import { run, ethers } from 'hardhat';

async function main() {
  const strategyAdderToAdd = '';
  const tradeFactory = await ethers.getContract('TradeFactory');
  await tradeFactory.grantRole(await tradeFactory.STRATEGY_ADDER(), strategyAdderToAdd);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
