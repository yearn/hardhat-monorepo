import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getChainId, shouldVerifyContract } from '@utils/deploy';

export const ONE_INCH: { [chainId: string]: string } = {
  // Mainnet
  '1': '0x11111112542D85B3EF69AE05771c2dCCff4fAa26',
  // Polygon
  '137': '0x11111112542D85B3EF69AE05771c2dCCff4fAa26',
};

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor } = await hre.getNamedAccounts();

  const tradeFactory = await hre.deployments.get('TradeFactory');

  const chainId = await getChainId(hre);

  const deploy = await hre.deployments.deploy('OneInchAggregator', {
    contract: 'contracts/swappers/async/OneInchAggregatorSwapper.sol:OneInchAggregatorSwapper',
    from: deployer,
    args: [governor, tradeFactory.address, ONE_INCH[chainId]],
    log: true,
  });

  if (await shouldVerifyContract(deploy)) {
    await hre.run('verify:verify', {
      address: deploy.address,
      constructorArguments: [governor, tradeFactory.address, ONE_INCH[chainId]],
    });
  }
};
deployFunction.dependencies = ['TradeFactory'];
deployFunction.tags = ['Mainnet', 'Polygon', 'OneInchAggregator'];
export default deployFunction;
