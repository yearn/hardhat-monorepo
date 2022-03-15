import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getChainId, shouldVerifyContract } from '@utils/deploy';
import { BigNumber, BigNumberish, utils } from 'ethers/lib/ethers';
import * as contracts from '../../utils/contracts';
import moment from 'moment';
import { SUPPORTED_NETWORKS_IDS, NETWORK_ID_NAMES } from '@utils/network';

export const WORK_COOLDOWN: { [chainId: string]: BigNumberish } = {
  '250': moment.duration('30', 'minutes').as('seconds'),
};

export const CALL_COST: { [chainId: string]: BigNumber } = {
  '250': utils.parseEther('0.5'),
};

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  const chainId = (await getChainId(hre)) as SUPPORTED_NETWORKS_IDS;
  const chainName = NETWORK_ID_NAMES[chainId];

  if (!contracts.weth[chainName] || !contracts.mechanicsRegistry[chainName] || !contracts.v2Keeper[chainName]) {
    console.log('ERROR: missing contracts');
    return;
  }

  if (contracts.harvestV2DetachedJob[chainName]) {
    console.log('HarvestV2DetachedGaslessJob already deployed at:', contracts.harvestV2DetachedJob[chainName]);
    return;
  }

  const deploy = await hre.deployments.deploy('HarvestV2DetachedGaslessJob', {
    contract: 'contracts/jobs/detached-gasless/HarvestV2DetachedGaslessJob.sol:HarvestV2DetachedGaslessJob',
    from: deployer,
    args: [
      contracts.weth[chainName],
      contracts.mechanicsRegistry[chainName],
      contracts.v2Keeper[chainName],
      WORK_COOLDOWN[chainId],
      CALL_COST[chainId],
    ],
    log: true,
  });

  if (await shouldVerifyContract(deploy)) {
    await hre.run('verify:verify', {
      address: deploy.address,
      constructorArguments: [
        contracts.weth[chainName],
        contracts.mechanicsRegistry[chainName],
        contracts.v2Keeper[chainName],
        WORK_COOLDOWN[chainId],
        CALL_COST[chainId],
      ],
    });
  }
};

deployFunction.dependencies = [];
deployFunction.tags = ['HarvestV2DetachedGaslessJob', 'NewNetwork'];
export default deployFunction;
