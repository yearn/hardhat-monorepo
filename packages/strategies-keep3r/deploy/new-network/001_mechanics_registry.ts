import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getChainId, shouldVerifyContract } from '@utils/deploy';
import * as contracts from '../../utils/contracts';
import { NETWORK_ID_NAMES, NETWORK_NAME_IDS, SUPPORTED_NETWORKS_IDS } from '@utils/network';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  const chainId = (await getChainId(hre)) as SUPPORTED_NETWORKS_IDS;
  const chainName = NETWORK_ID_NAMES[chainId];

  if (!contracts.yMechanicsDefaultOwner[chainName]) {
    console.log('ERROR: missing yMechanicsDefaultOwner');
    return;
  }

  if (contracts.mechanicsRegistry[chainName]) {
    console.log('MechanicsRegistry already deployed at:', contracts.mechanicsRegistry[chainName]);
    return;
  }
  const deploy = await hre.deployments.deploy('MechanicsRegistry', {
    contract: 'MechanicsRegistry',
    from: deployer,
    args: [contracts.yMechanicsDefaultOwner[chainName]],
    log: true,
  });

  if (await shouldVerifyContract(deploy)) {
    await hre.run('verify:verify', {
      address: deploy.address,
      constructorArguments: [contracts.yMechanicsDefaultOwner[chainName]],
    });
  }
};
deployFunction.dependencies = [];
deployFunction.tags = ['MechanicsRegistry', 'NewNetwork'];
export default deployFunction;
