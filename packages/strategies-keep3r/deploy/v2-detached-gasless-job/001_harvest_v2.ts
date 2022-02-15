import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getChainId, shouldVerifyContract } from '@utils/deploy';
import { BigNumber, BigNumberish, utils } from 'ethers/lib/ethers';
import * as contracts from '../../utils/contracts';
import moment from 'moment';

export const WETH: { [chainId: string]: string } = {
  // Fantom
  '250': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
};

export const MECHANICS_REGISTRY: { [chainId: string]: string } = {
  // Fantom
  '250': contracts.mechanicsRegistry.fantom!,
};

export const V2_KEEPER: { [chainId: string]: string } = {
  // Fantom
  '250': contracts.v2Keeper.fantom!,
};

export const WORK_COOLDOWN: { [chainId: string]: BigNumberish } = {
  // Fantom
  '250': moment.duration('30', 'minutes').as('seconds'),
};

export const CALL_COST: { [chainId: string]: BigNumber } = {
  // Fantom
  '250': utils.parseEther('0.5'),
};

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  const chainId = await getChainId(hre);

  const deploy = await hre.deployments.deploy('HarvestV2DetachedGaslessJob', {
    contract: 'contracts/jobs/detached-gasless/HarvestV2DetachedGaslessJob.sol:HarvestV2DetachedGaslessJob',
    from: deployer,
    args: [WETH[chainId], MECHANICS_REGISTRY[chainId], V2_KEEPER[chainId], WORK_COOLDOWN[chainId], CALL_COST[chainId]],
    log: true,
  });

  if (await shouldVerifyContract(deploy)) {
    await hre.run('verify:verify', {
      address: deploy.address,
      constructorArguments: [WETH[chainId], MECHANICS_REGISTRY[chainId], V2_KEEPER[chainId], WORK_COOLDOWN[chainId], CALL_COST[chainId]],
    });
  }
};
deployFunction.dependencies = [];
deployFunction.tags = ['HarvestV2DetachedGaslessJob'];
export default deployFunction;
