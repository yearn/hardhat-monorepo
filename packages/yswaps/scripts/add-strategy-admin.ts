import { run, ethers } from 'hardhat';

async function main() {
  const strategyAdminToAdd = '0x1ea056c13f8ccc981e51c5f1cdf87476666d0a74';
  const tradeFactory = await ethers.getContract('TradeFactory');
  await tradeFactory.grantRole(await tradeFactory.STRATEGY_ADMIN(), strategyAdminToAdd);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
