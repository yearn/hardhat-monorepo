import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { shouldVerifyContract } from '@utils/deploy';

export const SOLIDLY_FACTORY = '0x3faab499b519fdc5819e3d7ed0c26111904cbc28';
export const SOLIDLY_ROUTER = '0xa38cd27185a464914D3046f0AB9d43356B34829D';
export const WETH = '0x74b23882a30290451A17c44f4F05243b6b58C76d';
export const WFTM = '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor } = await hre.getNamedAccounts();

  const tradeFactory = await hre.deployments.get('TradeFactory');

  const asyncDeploy = await hre.deployments.deploy('AsyncSolidly', {
    contract: 'contracts/swappers/async/SolidlySwapper.sol:SolidlySwapper',
    from: deployer,
    args: [governor, tradeFactory.address, SOLIDLY_ROUTER],
    log: true,
  });

  if (await shouldVerifyContract(asyncDeploy)) {
    await hre.run('verify:verify', {
      address: asyncDeploy.address,
      constructorArguments: [governor, tradeFactory.address, SOLIDLY_ROUTER],
    });
  }

  //   const syncDeploy = await hre.deployments.deploy('SyncSolidly', {
  //     contract: 'contracts/swappers/sync/UniswapV2AnchorSwapper.sol:UniswapV2AnchorSwapper',
  //     from: deployer,
  //     args: [governor, tradeFactory.address, WETH, WFTM, SPIRITSWAP_FACTORY, SPIRITSWAP_ROUTER],
  //     log: true,
  //   });

  //   if (await shouldVerifyContract(syncDeploy)) {
  //     await hre.run('verify:verify', {
  //       address: syncDeploy.address,
  //       constructorArguments: [governor, tradeFactory.address, WETH, WFTM, SPIRITSWAP_FACTORY, SPIRITSWAP_ROUTER],
  //     });
  //   }
};

deployFunction.dependencies = ['TradeFactory'];
deployFunction.tags = ['Solidly', 'Fantom'];
export default deployFunction;
