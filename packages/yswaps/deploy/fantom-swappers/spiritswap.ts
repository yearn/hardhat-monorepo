import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { shouldVerifyContract } from '@utils/deploy';

export const SPIRITSWAP_FACTORY = '0xef45d134b73241eda7703fa787148d9c9f4950b0';
export const SPIRITSWAP_ROUTER = '0x16327e3fbdaca3bcf7e38f5af2599d2ddc33ae52';
export const WETH = '0x74b23882a30290451A17c44f4F05243b6b58C76d';
export const WFTM = '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor } = await hre.getNamedAccounts();

  const tradeFactory = await hre.deployments.get('TradeFactory');

  const asyncDeploy = await hre.deployments.deploy('AsyncSpiritswap', {
    contract: 'contracts/swappers/async/UniswapV2Swapper.sol:UniswapV2Swapper',
    from: deployer,
    args: [governor, tradeFactory.address, SPIRITSWAP_FACTORY, SPIRITSWAP_ROUTER],
    log: true,
  });

  if (await shouldVerifyContract(asyncDeploy)) {
    await hre.run('verify:verify', {
      address: asyncDeploy.address,
      constructorArguments: [governor, tradeFactory.address, SPIRITSWAP_FACTORY, SPIRITSWAP_ROUTER],
    });
  }

  const syncDeploy = await hre.deployments.deploy('SyncSpiritswap', {
    contract: 'contracts/swappers/sync/UniswapV2AnchorSwapper.sol:UniswapV2AnchorSwapper',
    from: deployer,
    args: [governor, tradeFactory.address, WETH, WFTM, SPIRITSWAP_FACTORY, SPIRITSWAP_ROUTER],
    log: true,
  });

  if (await shouldVerifyContract(syncDeploy)) {
    await hre.run('verify:verify', {
      address: syncDeploy.address,
      constructorArguments: [governor, tradeFactory.address, WETH, WFTM, SPIRITSWAP_FACTORY, SPIRITSWAP_ROUTER],
    });
  }
};
deployFunction.dependencies = ['TradeFactory'];
deployFunction.tags = ['Spiritswap', 'Fantom'];
export default deployFunction;
