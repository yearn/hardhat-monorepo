import {
  abi as MECHANICS_REGISTRY_ABI,
  bytecode as MECHANICS_REGISTRY_EVMCODE,
} from '@yearn/contract-utils/artifacts/contracts/mechanics/MechanicsRegistry.sol/MechanicsRegistry.json';
import {
  abi as MACHINERY_ABI,
  bytecode as MACHINERY_BYTECODE,
} from '@yearn/contract-utils/artifacts/contracts/utils/Machinery.sol/Machinery.json';
import { uniswap, wallet } from '@test-utils';
import { deployContract } from 'ethereum-waffle';
import { Contract, utils } from 'ethers';
import { ethers } from 'hardhat';
interface MechanicsRegistryFixture {
  mechanicsRegistry: Contract;
}

export const mechanicsRegistryFixture = async (mechanic: string): Promise<MechanicsRegistryFixture> => {
  const [deployer] = await ethers.getSigners();
  const mechanicsRegistry = await deployContract(deployer, { abi: MECHANICS_REGISTRY_ABI, bytecode: MECHANICS_REGISTRY_EVMCODE }, [mechanic]);
  return { mechanicsRegistry };
};

interface MachineryFixture extends MechanicsRegistryFixture {
  machinery: Contract;
}

export const machineryFixture = async (mechanic: string): Promise<MachineryFixture> => {
  const { mechanicsRegistry } = await mechanicsRegistryFixture(mechanic);
  const [deployer] = await ethers.getSigners();
  const machinery = await deployContract(deployer, { abi: MACHINERY_ABI, bytecode: MACHINERY_BYTECODE }, [mechanicsRegistry.address]);
  return { mechanicsRegistry, machinery };
};

interface TradeFactoryFixture {
  tradeFactory: Contract;
}

export const tradeFactoryFixture = async (
  masterAdmin: string,
  swapperAdder: string,
  swapperSetter: string,
  strategyAdder: string,
  tradeModifier: string,
  tradeSettler: string,
  mechanicsRegistry: string
): Promise<TradeFactoryFixture> => {
  const tradeFactoryFactory = await ethers.getContractFactory('contracts/TradeFactory/TradeFactory.sol:TradeFactory');
  const tradeFactory = await tradeFactoryFactory.deploy(
    masterAdmin,
    swapperAdder,
    swapperSetter,
    strategyAdder,
    tradeModifier,
    tradeSettler,
    mechanicsRegistry
  );
  return {
    tradeFactory,
  };
};

interface OTCPoolFixture extends TradeFactoryFixture {
  otcPool: Contract;
}

export const otcPoolFixture = async (
  masterAdmin: string,
  swapperAdder: string,
  swapperSetter: string,
  strategyAdder: string,
  tradeModifier: string,
  tradeSettler: string,
  mechanicsRegistry: string,
  otcPoolGovernor: string
): Promise<OTCPoolFixture> => {
  const { tradeFactory } = await tradeFactoryFixture(
    masterAdmin,
    swapperAdder,
    swapperSetter,
    strategyAdder,
    tradeModifier,
    tradeSettler,
    mechanicsRegistry
  );
  const otcPoolFactory = await ethers.getContractFactory('contracts/OTCPool.sol:OTCPool');
  const masterAdminSigner = await wallet.impersonate(masterAdmin);
  const otcPool = await otcPoolFactory.deploy(otcPoolGovernor, tradeFactory.address);
  await tradeFactory.connect(masterAdminSigner).setOTCPool(otcPool.address);
  return {
    tradeFactory,
    otcPool,
  };
};

interface UniswapV2SwapperFixture extends OTCPoolFixture {
  WETH: Contract;
  uniswapV2Factory: Contract;
  uniswapV2Router02: Contract;
  uniswapV2AsyncSwapper: Contract;
  uniswapV2SyncSwapper: Contract;
}

export const uniswapV2SwapperFixture = async (
  masterAdmin: string,
  swapperAdder: string,
  swapperSetter: string,
  strategyAdder: string,
  tradeModifier: string,
  tradeSettler: string,
  mechanicsRegistry: string,
  otcPoolGovernor: string
): Promise<UniswapV2SwapperFixture> => {
  const { tradeFactory, otcPool } = await otcPoolFixture(
    masterAdmin,
    swapperAdder,
    swapperSetter,
    strategyAdder,
    tradeModifier,
    tradeSettler,
    mechanicsRegistry,
    otcPoolGovernor
  );
  const uniswapV2AsyncSwapperFactory = await ethers.getContractFactory('contracts/swappers/async/UniswapV2Swapper.sol:UniswapV2Swapper');
  const uniswapV2SyncSwapperFactory = await ethers.getContractFactory('contracts/swappers/sync/UniswapV2Swapper.sol:UniswapV2Swapper');
  const owner = await wallet.generateRandom();
  await ethers.provider.send('hardhat_setBalance', [owner.address, utils.parseEther('10').toHexString()]);
  const uniswapDeployment = await uniswap.deploy({ owner });
  const uniswapV2AsyncSwapper = await uniswapV2AsyncSwapperFactory.deploy(
    masterAdmin,
    tradeFactory.address,
    uniswapDeployment.uniswapV2Factory.address,
    uniswapDeployment.uniswapV2Router02.address
  );
  const uniswapV2SyncSwapper = await uniswapV2SyncSwapperFactory.deploy(
    masterAdmin,
    tradeFactory.address,
    uniswapDeployment.WETH.address,
    uniswapDeployment.uniswapV2Factory.address,
    uniswapDeployment.uniswapV2Router02.address
  );
  return {
    tradeFactory,
    otcPool,
    uniswapV2AsyncSwapper,
    uniswapV2SyncSwapper,
    ...uniswapDeployment,
  };
};
