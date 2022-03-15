import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getChainId, shouldVerifyContract } from '@utils/deploy';
import * as contracts from '../../utils/contracts';
import { NETWORK_ID_NAMES, SUPPORTED_NETWORKS_IDS } from '@utils/network';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  const chainId = (await getChainId(hre)) as SUPPORTED_NETWORKS_IDS;
  const chainName = NETWORK_ID_NAMES[chainId];

  if (!contracts.mechanicsRegistry[chainName]) {
    console.log('ERROR: missing mechanicsRegistry');
    return;
  }

  if (contracts.v2Keeper[chainName]) {
    console.log('V2Keeper already deployed at:', contracts.v2Keeper[chainName]);
    return;
  }

  const deploy = await hre.deployments.deploy('V2Keeper', {
    contract: 'V2Keeper',
    from: deployer,
    args: [contracts.mechanicsRegistry[chainName]],
    log: true,
  });

  if (await shouldVerifyContract(deploy)) {
    await hre.run('verify:verify', {
      address: deploy.address,
      constructorArguments: [contracts.mechanicsRegistry[chainName]],
    });
  }
};
deployFunction.dependencies = [];
deployFunction.tags = ['V2Keeper'];
export default deployFunction;
