import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getChainId, shouldVerifyContract } from '@utils/deploy';

export const SUSHISWAP_FACTORY: { [chainId: string]: string } = {
  // Mainnet
  '1': '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
  // Polygon
  '137': '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
};

export const SUSHISWAP_ROUTER: { [chainId: string]: string } = {
  // Mainnet
  '1': '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
  // Polygon
  '137': '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
};

export const WETH: { [chainId: string]: string } = {
  // Mainnet
  '1': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  // Polygon
  '137': '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
};

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor } = await hre.getNamedAccounts();

  const tradeFactory = await hre.deployments.get('TradeFactory');

  const chainId = await getChainId(hre);

  const asyncDeploy = await hre.deployments.deploy('AsyncSushiswap', {
    contract: 'contracts/swappers/async/UniswapV2Swapper.sol:UniswapV2Swapper',
    from: deployer,
    args: [governor, tradeFactory.address, SUSHISWAP_FACTORY[chainId], SUSHISWAP_ROUTER[chainId]],
    log: true,
  });

  if (await shouldVerifyContract(asyncDeploy)) {
    await hre.run('verify:verify', {
      address: asyncDeploy.address,
      constructorArguments: [governor, tradeFactory.address, SUSHISWAP_FACTORY[chainId], SUSHISWAP_ROUTER[chainId]],
    });
  }

  const syncDeploy = await hre.deployments.deploy('SyncSushiswap', {
    contract: 'contracts/swappers/sync/UniswapV2Swapper.sol:UniswapV2Swapper',
    from: deployer,
    args: [governor, tradeFactory.address, WETH[chainId], SUSHISWAP_FACTORY[chainId], SUSHISWAP_ROUTER[chainId]],
    log: true,
  });

  if (await shouldVerifyContract(syncDeploy)) {
    await hre.run('verify:verify', {
      address: syncDeploy.address,
      constructorArguments: [governor, tradeFactory.address, WETH[chainId], SUSHISWAP_FACTORY[chainId], SUSHISWAP_ROUTER[chainId]],
    });
  }
};
deployFunction.dependencies = ['TradeFactory'];
deployFunction.tags = ['Sushiswap', 'Polygon', 'Mainnet'];
export default deployFunction;
