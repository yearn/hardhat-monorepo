import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { shouldVerifyContract } from '@utils/deploy';

export const SPOOKYSWAP_FACTORY = '0x152eE697f2E276fA89E96742e9bB9aB1F2E61bE3';
export const SPOOKYSWAP_ROUTER = '0xF491e7B69E4244ad4002BC14e878a34207E38c29';
export const WETH = '0x74b23882a30290451A17c44f4F05243b6b58C76d';
export const WFTM = '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor } = await hre.getNamedAccounts();

  const tradeFactory = await hre.deployments.get('TradeFactory');

  const asyncDeploy = await hre.deployments.deploy('AsyncSpookyswap', {
    contract: 'contracts/swappers/async/UniswapV2Swapper.sol:UniswapV2Swapper',
    from: deployer,
    args: [governor, tradeFactory.address, SPOOKYSWAP_FACTORY, SPOOKYSWAP_ROUTER],
    log: true,
  });

  if (await shouldVerifyContract(asyncDeploy)) {
    await hre.run('verify:verify', {
      address: asyncDeploy.address,
      constructorArguments: [governor, tradeFactory.address, SPOOKYSWAP_FACTORY, SPOOKYSWAP_ROUTER],
    });
  }

  const syncDeploy = await hre.deployments.deploy('SyncSpookyswap', {
    contract: 'contracts/swappers/sync/UniswapV2AnchorSwapper.sol:UniswapV2AnchorSwapper',
    from: deployer,
    args: [governor, tradeFactory.address, WETH, WFTM, SPOOKYSWAP_FACTORY, SPOOKYSWAP_ROUTER],
    log: true,
  });

  if (await shouldVerifyContract(syncDeploy)) {
    await hre.run('verify:verify', {
      address: syncDeploy.address,
      constructorArguments: [governor, tradeFactory.address, WETH, WFTM, SPOOKYSWAP_FACTORY, SPOOKYSWAP_ROUTER],
    });
  }
};
deployFunction.dependencies = ['TradeFactory'];
deployFunction.tags = ['Spookyswap', 'Fantom'];
export default deployFunction;
