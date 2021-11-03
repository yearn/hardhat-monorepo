import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { shouldVerifyContract } from '@utils/deploy';
import { ethers } from 'ethers';

export const CONTRACT_REGISTRY = '0x52Ae12ABe5D8BD778BD5397F99cA900624CfADD4';
export const BANCOR_NETWORK_NAME = ethers.utils.formatBytes32String('BancorNetwork');

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor } = await hre.getNamedAccounts();

  const tradeFactory = await hre.deployments.get('TradeFactory');

  const asyncDeploy = await hre.deployments.deploy('AsyncBancor', {
    contract: 'contracts/swappers/async/BancorSwapper.sol:BancorSwapper',
    from: deployer,
    args: [governor, tradeFactory.address, CONTRACT_REGISTRY, BANCOR_NETWORK_NAME],
    log: true,
  });

  if (await shouldVerifyContract(asyncDeploy)) {
    await hre.run('verify:verify', {
      address: asyncDeploy.address,
      constructorArguments: [governor, tradeFactory.address, CONTRACT_REGISTRY, BANCOR_NETWORK_NAME],
    });
  }

  const syncDeploy = await hre.deployments.deploy('SyncBancor', {
    contract: 'contracts/swappers/sync/BancorSwapper.sol:BancorSwapper',
    from: deployer,
    args: [governor, tradeFactory.address, CONTRACT_REGISTRY, BANCOR_NETWORK_NAME],
    log: true,
  });

  if (await shouldVerifyContract(syncDeploy)) {
    await hre.run('verify:verify', {
      address: syncDeploy.address,
      constructorArguments: [governor, tradeFactory.address, CONTRACT_REGISTRY, BANCOR_NETWORK_NAME],
    });
  }
};
deployFunction.dependencies = ['TradeFactory'];
deployFunction.tags = ['Bancor', 'Mainnet'];
export default deployFunction;
