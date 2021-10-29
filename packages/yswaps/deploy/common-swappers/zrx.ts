import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getChainId, shouldVerifyContract } from '@utils/deploy';

export const ZRX: { [chainId: string]: string } = {
  // Mainnet
  '1': '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
  // Polygon
  '137': '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
  // Fantom
  '250': '0xdef189deaef76e379df891899eb5a00a94cbc250',
};

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor } = await hre.getNamedAccounts();

  const tradeFactory = await hre.deployments.get('TradeFactory');

  const chainId = await getChainId(hre);

  const deploy = await hre.deployments.deploy('ZRX', {
    contract: 'contracts/swappers/async/ZRXSwapper.sol:ZRXSwapper',
    from: deployer,
    args: [governor, tradeFactory.address, ZRX[chainId]],
    log: true,
  });

  if (await shouldVerifyContract(deploy)) {
    await hre.run('verify:verify', {
      address: deploy.address,
      constructorArguments: [governor, tradeFactory.address, ZRX[chainId]],
    });
  }
};
deployFunction.dependencies = ['TradeFactory'];
deployFunction.tags = ['Mainnet', 'Fantom', 'Polygon', 'ZRX'];
export default deployFunction;
