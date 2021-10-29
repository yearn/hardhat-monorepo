import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { shouldVerifyContract } from '@utils/deploy';

const SUSHISWAP_FACTORY = '0xc35DADB65012eC5796536bD9864eD8773aBc74C4';
const SUSHISWAP_ROUTER = '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506';
const WMATIC = '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270';
const WETH = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor } = await hre.getNamedAccounts();

  const tradeFactory = await hre.deployments.get('TradeFactory');

  const asyncDeploy = await hre.deployments.deploy('AsyncSushiswap', {
    contract: 'contracts/swappers/async/UniswapV2Swapper.sol:UniswapV2Swapper',
    from: deployer,
    args: [governor, tradeFactory.address, SUSHISWAP_FACTORY, SUSHISWAP_ROUTER],
    log: true,
  });

  if (await shouldVerifyContract(asyncDeploy)) {
    await hre.run('verify:verify', {
      address: asyncDeploy.address,
      constructorArguments: [governor, tradeFactory.address, SUSHISWAP_FACTORY, SUSHISWAP_ROUTER],
    });
  }

  const syncDeploy = await hre.deployments.deploy('SyncSushiswap', {
    contract: 'contracts/swappers/sync/UniswapV2AnchorSwapper.sol:UniswapV2AnchorSwapper',
    from: deployer,
    args: [governor, tradeFactory.address, WETH, WMATIC, SUSHISWAP_FACTORY, SUSHISWAP_ROUTER],
    log: true,
  });

  if (await shouldVerifyContract(syncDeploy)) {
    await hre.run('verify:verify', {
      address: syncDeploy.address,
      constructorArguments: [governor, tradeFactory.address, WETH, WMATIC, SUSHISWAP_FACTORY, SUSHISWAP_ROUTER],
    });
  }
};
deployFunction.dependencies = ['TradeFactory'];
deployFunction.tags = ['Sushiswap', 'Polygon'];
export default deployFunction;
