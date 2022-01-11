import {
  abi as MECHANICS_REGISTRY_ABI,
  bytecode as MECHANICS_REGISTRY_EVMCODE,
} from '@yearn/contract-utils/artifacts/contracts/mechanics/MechanicsRegistry.sol/MechanicsRegistry.json';
import {
  abi as MACHINERY_ABI,
  bytecode as MACHINERY_BYTECODE,
} from '@yearn/contract-utils/artifacts/contracts/utils/Machinery.sol/Machinery.json';
import { uniswap, wallet } from '@test-utils';
import { TradeFactory, TradeFactory__factory } from '@typechained';
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
  tradeFactory: TradeFactory;
}

export const tradeFactoryFixture = async (
  masterAdmin: string,
  swapperAdder: string,
  swapperSetter: string,
  strategyAdder: string,
  mechanicsRegistry: string
): Promise<TradeFactoryFixture> => {
  const tradeFactoryFactory = (await ethers.getContractFactory('contracts/TradeFactory/TradeFactory.sol:TradeFactory')) as TradeFactory__factory;
  const tradeFactory = await tradeFactoryFactory.deploy(masterAdmin, swapperAdder, swapperSetter, strategyAdder, mechanicsRegistry);
  return {
    tradeFactory,
  };
};

interface UniswapV2SwapperFixture extends TradeFactoryFixture {
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
  mechanicsRegistry: string
): Promise<UniswapV2SwapperFixture> => {
  const { tradeFactory } = await tradeFactoryFixture(masterAdmin, swapperAdder, swapperSetter, strategyAdder, mechanicsRegistry);
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
    uniswapV2AsyncSwapper,
    uniswapV2SyncSwapper,
    ...uniswapDeployment,
  };
};

interface MultiCallOptimizedSwapperFixture extends TradeFactoryFixture {
  multiCallOptimizedAsyncSwapper: Contract;
}

export const multiCallOptimizedSwapperFixture = async (
  masterAdmin: string,
  swapperAdder: string,
  swapperSetter: string,
  strategyAdder: string,
  mechanicsRegistry: string
): Promise<MultiCallOptimizedSwapperFixture> => {
  const { tradeFactory } = await tradeFactoryFixture(masterAdmin, swapperAdder, swapperSetter, strategyAdder, mechanicsRegistry);
  const multiCallOptimizedAsyncSwapperFactory = await ethers.getContractFactory(
    'contracts/swappers/async/MultiCallOptimizedSwapper.sol:MultiCallOptimizedSwapper'
  );
  const multiCallOptimizedAsyncSwapper = await multiCallOptimizedAsyncSwapperFactory.deploy(masterAdmin, tradeFactory.address);

  return {
    tradeFactory,
    multiCallOptimizedAsyncSwapper,
  };
};
