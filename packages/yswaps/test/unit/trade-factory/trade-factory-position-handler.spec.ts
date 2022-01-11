import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { evm, wallet } from '@test-utils';
import { contract, given, then, when } from '@test-utils/bdd';
import { abi as swapperABI } from '@artifacts/contracts/swappers/Swapper.sol/ISwapper.json';
import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { BigNumber, constants, utils } from 'ethers';
import Web3 from 'web3';
import { ISwapper, TradeFactoryPositionsHandlerMock, TradeFactoryPositionsHandlerMock__factory } from '@typechained';

contract('TradeFactoryPositionsHandler', () => {
  let deployer: SignerWithAddress;
  let masterAdmin: SignerWithAddress;
  let strategy: SignerWithAddress;
  let swapperAdder: SignerWithAddress;
  let swapperSetter: SignerWithAddress;
  let strategyAdder: SignerWithAddress;
  let positionsHandlerFactory: MockContractFactory<TradeFactoryPositionsHandlerMock__factory>;
  let positionsHandler: MockContract<TradeFactoryPositionsHandlerMock>;
  let asyncSwapper: FakeContract<ISwapper>;
  let snapshotId: string;

  const MASTER_ADMIN_ROLE: string = new Web3().utils.soliditySha3('MASTER_ADMIN') as string;
  const STRATEGY_ROLE: string = new Web3().utils.soliditySha3('STRATEGY') as string;
  const STRATEGY_ADDER_ROLE: string = new Web3().utils.soliditySha3('STRATEGY_ADDER') as string;

  before(async () => {
    [deployer, masterAdmin, swapperAdder, swapperSetter, strategyAdder, strategy] = await ethers.getSigners();
    positionsHandlerFactory = await smock.mock<TradeFactoryPositionsHandlerMock__factory>(
      'contracts/mock/TradeFactory/TradeFactoryPositionsHandler.sol:TradeFactoryPositionsHandlerMock',
      strategy
    );
    positionsHandler = await positionsHandlerFactory.deploy(
      masterAdmin.address,
      swapperAdder.address,
      swapperSetter.address,
      strategyAdder.address
    );
    asyncSwapper = await smock.fake<ISwapper>(swapperABI);
    await positionsHandler.connect(swapperAdder).addSwappers([asyncSwapper.address]);
    await positionsHandler.connect(strategyAdder).grantRole(STRATEGY_ROLE, strategy.address);
    snapshotId = await evm.snapshot.take();
  });

  beforeEach(async () => {
    await evm.snapshot.revert(snapshotId);
  });

  describe('constructor', () => {
    when('strategy adder is zero address', () => {
      then('tx is reverted with message');
    });
    when('trades modifier is zero address', () => {
      then('tx is reverted with message');
    });
    when('all arguments are valid', () => {
      then('strategy adder is set');
      then('trades modifier is set');
      then('admin role of strategy is strategy adder', async () => {
        expect(await positionsHandler.getRoleAdmin(STRATEGY_ROLE)).to.equal(STRATEGY_ADDER_ROLE);
      });
      then('admin role of strategy admin is master admin', async () => {
        expect(await positionsHandler.getRoleAdmin(STRATEGY_ADDER_ROLE)).to.equal(MASTER_ADMIN_ROLE);
      });
    });
  });

  describe('create', () => {
    let swapper: FakeContract<ISwapper>;
    const tokenIn = wallet.generateRandomAddress();
    const tokenOut = wallet.generateRandomAddress();
    const amountIn = utils.parseEther('100');
    given(async () => {
      swapper = await smock.fake<ISwapper>(swapperABI);
      await positionsHandler.connect(swapperAdder).addSwappers([swapper.address]);
    });
    when('strategy is not registered', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.connect(deployer).create(tokenIn, tokenOut, amountIn)).to.be.revertedWith(
          `AccessControl: account ${deployer.address.toLowerCase()} is missing role ${STRATEGY_ROLE.toLowerCase()}`
        );
      });
    });
    when('token in is zero address', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.create(constants.AddressZero, tokenOut, amountIn)).to.be.revertedWith('ZeroAddress()');
      });
    });
    when('token out is zero address', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.create(tokenIn, constants.AddressZero, amountIn)).to.be.revertedWith('ZeroAddress()');
      });
    });
    when('amount in is zero', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.create(tokenIn, tokenOut, constants.Zero)).to.be.revertedWith('ZeroAmount()');
      });
    });
    when('all data is correct', () => {
      let createTx: TransactionResponse;
      let tradeId: BigNumber;
      given(async () => {
        ({ tx: createTx, id: tradeId } = await create({
          tokenIn,
          tokenOut,
          amountIn,
        }));
      });
    });
  });

  async function create({
    tokenIn,
    tokenOut,
    amountIn,
  }: {
    tokenIn: string;
    tokenOut: string;
    amountIn: BigNumber;
  }): Promise<{ tx: TransactionResponse; id: BigNumber }> {
    const tx = await positionsHandler.connect(strategy).create(tokenIn, tokenOut, amountIn);
    const txReceipt = await tx.wait();
    const parsedEvent = positionsHandler.interface.parseLog(txReceipt.logs[0]);
    return { tx, id: parsedEvent.args._id };
  }
});
