import { impersonate } from '@test-utils/wallet';
import { ethers } from 'hardhat';

export const enableTradeFactory = async ({ strategyAddress, tradeFactoryAddress }: { strategyAddress: string; tradeFactoryAddress: string }) => {
  const strategy = await ethers.getContractAt('IBaseStrategy', strategyAddress);
  const vault = await ethers.getContractAt('IVault', await strategy.vault());
  const strategyGovernance = await impersonate(await vault.governance());
  await strategy.connect(strategyGovernance).updateTradeFactory(tradeFactoryAddress);
};
