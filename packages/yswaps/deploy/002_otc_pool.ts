import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getChainId, shouldVerifyContract } from '@utils/deploy';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor } = await hre.getNamedAccounts();

  const chainId = await getChainId(hre);

  const tradeFactory = await hre.deployments.get('TradeFactory');

  const deploy = await hre.deployments.deploy('OTCPool', {
    contract: 'contracts/OTCPool.sol:OTCPool',
    from: deployer,
    args: [governor, tradeFactory.address],
    log: true,
  });

  if (await shouldVerifyContract(deploy)) {
    await hre.run('verify:verify', {
      address: deploy.address,
      constructorArguments: [governor, tradeFactory.address],
    });
  }
};
deployFunction.dependencies = ['TradeFactory'];
deployFunction.tags = ['Common', 'OTCPool'];
export default deployFunction;
