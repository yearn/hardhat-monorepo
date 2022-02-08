import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { shouldVerifyContract } from '@utils/deploy';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor } = await hre.getNamedAccounts();

  const tradeFactory = await hre.deployments.get('TradeFactory');

  const asyncDeploy = await hre.deployments.deploy('MultiCallOptimizedSwapper', {
    contract: 'contracts/swappers/async/MultiCallOptimizedSwapper.sol:MultiCallOptimizedSwapper',
    from: deployer,
    args: [governor, tradeFactory.address],
    log: true,
  });

  if (await shouldVerifyContract(asyncDeploy)) {
    await hre.run('verify:verify', {
      address: asyncDeploy.address,
      constructorArguments: [governor, tradeFactory.address],
    });
  }
};
deployFunction.dependencies = ['TradeFactory'];
deployFunction.tags = ['MultiCallOptimized', 'Mainnet'];
export default deployFunction;
