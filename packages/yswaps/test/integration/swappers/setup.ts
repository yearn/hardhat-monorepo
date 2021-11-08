import { JsonRpcSigner } from '@ethersproject/providers';
import { SWAPPER_ADDER, SWAPPER_SETTER, STRATEGY_ADDER } from '@deploy/001_trade_factory';
import { wallet } from '@test-utils';
import { IERC20, ISwapper, TradeFactory } from '@typechained';
import { abi as IERC20_ABI } from '@openzeppelin/contracts/build/contracts/IERC20.json';
import { setTestChainId } from '@utils/deploy';
import { Wallet, BigNumber } from 'ethers';
import { ethers, getNamedAccounts, deployments } from 'hardhat';
import moment from 'moment';

type SetupParams = {
  chainId: number;
  fixture: string[];
  swapper: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  fromTokenWhaleAddress: string;
  strategy: Wallet;
  amountIn: BigNumber;
};

type SetupResponse = {
  fromToken: IERC20;
  toToken: IERC20;
  yMech: JsonRpcSigner;
  tradeFactory: TradeFactory;
  swapper: ISwapper;
};

const integrationSwapperSetup = async ({
  chainId,
  fixture,
  swapper,
  fromTokenAddress,
  toTokenAddress,
  fromTokenWhaleAddress,
  strategy,
  amountIn,
}: SetupParams): Promise<SetupResponse> => {
  const namedAccounts = await getNamedAccounts();

  const swapperAdder = await wallet.impersonate(SWAPPER_ADDER[chainId]);
  const strategyAdder = await wallet.impersonate(STRATEGY_ADDER[chainId]);
  const fromTokenWhale = await wallet.impersonate(fromTokenWhaleAddress);
  const yMech = await wallet.impersonate(namedAccounts.yMech);

  await ethers.provider.send('hardhat_setBalance', [namedAccounts.deployer, '0xffffffffffffffff']);
  await ethers.provider.send('hardhat_setBalance', [strategy.address, '0xffffffffffffffff']);

  setTestChainId(chainId);

  await deployments.fixture(fixture, { keepExistingDeployments: false });

  const fromToken = await ethers.getContractAt<IERC20>(IERC20_ABI, fromTokenAddress);
  const toToken = await ethers.getContractAt<IERC20>(IERC20_ABI, toTokenAddress);

  const tradeFactory = await ethers.getContract<TradeFactory>('TradeFactory');
  const deployedSwapper = await ethers.getContract<ISwapper>(swapper);

  await fromToken.connect(fromTokenWhale).transfer(strategy.address, amountIn);

  await tradeFactory.connect(strategyAdder).grantRole(await tradeFactory.STRATEGY(), strategy.address);
  await tradeFactory.connect(swapperAdder).addSwappers([deployedSwapper.address]);

  await fromToken.connect(strategy).approve(tradeFactory.address, amountIn);

  return { fromToken, toToken, yMech, tradeFactory, swapper: deployedSwapper };
};

export const async = async (setup: SetupParams): Promise<SetupResponse> => {
  const response = await integrationSwapperSetup(setup);
  await response.tradeFactory
    .connect(setup.strategy)
    .create(setup.fromTokenAddress, setup.toTokenAddress, setup.amountIn, moment().add('30', 'minutes').unix());
  return response;
};

export const sync = async (setup: SetupParams): Promise<SetupResponse> => {
  const swapperSetter = await wallet.impersonate(SWAPPER_SETTER[setup.chainId]);
  const response = await integrationSwapperSetup(setup);
  await response.tradeFactory.connect(swapperSetter).setStrategySyncSwapper(setup.strategy.address, response.swapper.address);
  return response;
};
