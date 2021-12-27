import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { shouldVerifyContract } from '@utils/deploy';

export const UNISWAP_V2_FACTORY = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
export const UNISWAP_V2_ROUTER = '0x7a250d5630b4cf539739df2c5dacb4c659f2488d';
export const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

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
