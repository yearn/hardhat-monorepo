import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { evm, wallet } from '@test-utils';
import { contract, given, then, when } from '@test-utils/bdd';
import { abi as swapperABI } from '@artifacts/contracts/swappers/Swapper.sol/ISwapper.json';
import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { BigNumber, constants, utils, Wallet } from 'ethers';
import Web3 from 'web3';
import moment from 'moment';
import { ISwapper, TradeFactoryPositionsHandlerMock, TradeFactoryPositionsHandlerMock__factory } from '@typechained';

contract('TradeFactoryPositionsHandler', () => {
  let deployer: SignerWithAddress;
  let masterAdmin: SignerWithAddress;
  let strategy: SignerWithAddress;
  let swapperAdder: SignerWithAddress;
  let swapperSetter: SignerWithAddress;
  let strategyAdder: SignerWithAddress;
  let tradesModifier: SignerWithAddress;
  let positionsHandlerFactory: MockContractFactory<TradeFactoryPositionsHandlerMock__factory>;
  let positionsHandler: MockContract<TradeFactoryPositionsHandlerMock>;
  let asyncSwapper: FakeContract<ISwapper>;
  let snapshotId: string;

  const MASTER_ADMIN_ROLE: string = new Web3().utils.soliditySha3('MASTER_ADMIN') as string;
  const STRATEGY_ROLE: string = new Web3().utils.soliditySha3('STRATEGY') as string;
  const STRATEGY_ADDER_ROLE: string = new Web3().utils.soliditySha3('STRATEGY_ADDER') as string;
  const TRADES_MODIFIER_ROLE: string = new Web3().utils.soliditySha3('TRADES_MODIFIER') as string;

  before(async () => {
    [deployer, masterAdmin, swapperAdder, swapperSetter, strategyAdder, tradesModifier, strategy] = await ethers.getSigners();
    positionsHandlerFactory = await smock.mock<TradeFactoryPositionsHandlerMock__factory>(
      'contracts/mock/TradeFactory/TradeFactoryPositionsHandler.sol:TradeFactoryPositionsHandlerMock',
      strategy
    );
    positionsHandler = await positionsHandlerFactory.deploy(
      masterAdmin.address,
      swapperAdder.address,
      swapperSetter.address,
      strategyAdder.address,
      tradesModifier.address
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
      then('admin role of trades modifier is master admin', async () => {
        expect(await positionsHandler.getRoleAdmin(TRADES_MODIFIER_ROLE)).to.equal(MASTER_ADMIN_ROLE);
      });
    });
  });

  describe('pendingTradesIds()', () => {
    when('there are no pending trades', () => {
      then('returns empty array', async () => {
        expect(await positionsHandler['pendingTradesIds()']()).to.be.empty;
      });
    });
    when('there are pending trades', () => {
      let tradeId: BigNumber;
      given(async () => {
        const tx = await create({
          tokenIn: wallet.generateRandomAddress(),
          tokenOut: wallet.generateRandomAddress(),
          amountIn: utils.parseEther('100'),
          deadline: moment().add('30', 'minutes').unix(),
        });
        tradeId = tx.id;
      });
      then('returns array of ids', async () => {
        expect(await positionsHandler['pendingTradesIds()']()).to.eql([tradeId]);
      });
    });
  });

  describe('pendingTradesIds(address)', () => {
    when('strategy doesnt have pending trades', () => {
      then('returns empty array', async () => {
        expect(await positionsHandler['pendingTradesIds(address)'](wallet.generateRandomAddress())).to.be.empty;
      });
    });
    when('strategy has pending trades', () => {
      let tradeId: BigNumber;
      given(async () => {
        const tx = await create({
          tokenIn: wallet.generateRandomAddress(),
          tokenOut: wallet.generateRandomAddress(),
          amountIn: utils.parseEther('100'),
          deadline: moment().add('30', 'minutes').unix(),
        });
        tradeId = tx.id;
      });
      then('returns array of ids', async () => {
        expect(await positionsHandler['pendingTradesIds(address)'](strategy.address)).to.eql([tradeId]);
      });
    });
  });

  describe('create', () => {
    let swapper: FakeContract<ISwapper>;
    const tokenIn = wallet.generateRandomAddress();
    const tokenOut = wallet.generateRandomAddress();
    const amountIn = utils.parseEther('100');
    const deadline = moment().add('30', 'minutes').unix();
    given(async () => {
      swapper = await smock.fake<ISwapper>(swapperABI);
      await positionsHandler.connect(swapperAdder).addSwappers([swapper.address]);
    });
    when('strategy is not registered', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.connect(deployer).create(tokenIn, tokenOut, amountIn, deadline)).to.be.revertedWith(
          `AccessControl: account ${deployer.address.toLowerCase()} is missing role ${STRATEGY_ROLE.toLowerCase()}`
        );
      });
    });
    when('token in is zero address', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.create(constants.AddressZero, tokenOut, amountIn, deadline)).to.be.revertedWith('ZeroAddress()');
      });
    });
    when('token out is zero address', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.create(tokenIn, constants.AddressZero, amountIn, deadline)).to.be.revertedWith('ZeroAddress()');
      });
    });
    when('amount in is zero', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.create(tokenIn, tokenOut, constants.Zero, deadline)).to.be.revertedWith('ZeroAmount()');
      });
    });
    when('deadline is equal or less than current timestamp', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.create(tokenIn, tokenOut, amountIn, constants.AddressZero)).to.be.revertedWith('InvalidDeadline()');
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
          deadline,
        }));
      });
      then('trade gets added to pending trades', async () => {
        const pendingTrade = await positionsHandler.pendingTradesById(tradeId);
        expect(pendingTrade._id).to.equal(BigNumber.from('1'));
        expect(pendingTrade._strategy).to.equal(strategy.address);
        expect(pendingTrade._tokenIn).to.equal(tokenIn);
        expect(pendingTrade._tokenOut).to.equal(tokenOut);
        expect(pendingTrade._amountIn).to.equal(amountIn);
        expect(pendingTrade._deadline).to.equal(deadline);
      });
      then('trade id gets added to pending trades by strategy', async () => {
        expect(await positionsHandler['pendingTradesIds(address)'](strategy.address)).to.eql([tradeId]);
      });
      then('trade id gets added to pending trades ids', async () => {
        expect(await positionsHandler['pendingTradesIds()']()).to.eql([tradeId]);
      });
      then('trade counter gets increased', async () => {
        expect(await positionsHandler.callStatic.create(tokenIn, tokenOut, amountIn, deadline)).to.be.equal(tradeId.add(1));
      });
      then('emits event', async () => {
        await expect(createTx)
          .to.emit(positionsHandler, 'TradeCreated')
          .withArgs(tradeId, strategy.address, tokenIn, tokenOut, amountIn, deadline);
      });
    });
  });

  describe('cancelPendingTrades', () => {
    given(async () => {
      await positionsHandler.create(
        wallet.generateRandomAddress(),
        wallet.generateRandomAddress(),
        utils.parseEther('100'),
        moment().add('30', 'minutes').unix()
      );
    });
    // TODO: only strategy
    when('pending trade does not exist', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.cancelPendingTrades([BigNumber.from('12')])).to.be.revertedWith('InvalidTrade()');
      });
    });
    when('trying to cancel trades not owned', () => {
      let randomStrategy: Wallet;
      given(async () => {
        randomStrategy = await wallet.generateRandom();
        await positionsHandler.connect(strategyAdder).grantRole(STRATEGY_ROLE, randomStrategy.address);
      });
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.connect(randomStrategy).cancelPendingTrades([1])).to.be.revertedWith('NotAuthorized()');
      });
    });
    when('trying to cancel trades not owned', () => {
      then('tx is reverted with reason');
    });
    when('pending trade exists', () => {
      let cancelTx: TransactionResponse;
      given(async () => {
        cancelTx = await positionsHandler.cancelPendingTrades([1]);
      });
      then('removes trade from trades', async () => {
        expect((await positionsHandler.pendingTradesById(1))._id).to.equal(0);
      });
      then(`removes trade from pending strategy's trade`, async () => {
        expect(await positionsHandler['pendingTradesIds(address)'](strategy.address)).to.be.empty;
      });
      then('removes trade from pending trades ids', async () => {
        expect(await positionsHandler['pendingTradesIds()']()).to.be.empty;
      });
      then('emits event', async () => {
        await expect(cancelTx).to.emit(positionsHandler, 'TradesCanceled').withArgs(strategy.address, [1]);
      });
    });
  });

  describe('mergePendingTrades', () => {
    const tokenIn = wallet.generateRandomAddress();
    const tokenOut = wallet.generateRandomAddress();
    const amountIn1 = utils.parseEther('100');
    const amountIn2 = utils.parseEther('0.23958');
    const amountIn3 = utils.parseEther('12.74958');
    const maxSlippage = 1000;
    const deadline = moment().add('30', 'minutes').unix();
    given(async () => {
      await create({
        tokenIn,
        tokenOut,
        amountIn: amountIn1,
        deadline,
      });
    });
    when('anchor trade does not exist', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.connect(tradesModifier).mergePendingTrades(99, [1])).to.be.revertedWith('InvalidTrade()');
      });
    });
    when('any of the trades to merge do not exist', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.connect(tradesModifier).mergePendingTrades(1, [99])).to.be.revertedWith('InvalidTrade()');
      });
    });
    when('merging trades from different strategies', () => {
      given(async () => {
        const randomStrategy = await wallet.generateRandom();
        await positionsHandler.connect(strategyAdder).grantRole(STRATEGY_ROLE, randomStrategy.address);
        await positionsHandler
          .connect(randomStrategy)
          .create(wallet.generateRandomAddress(), wallet.generateRandomAddress(), utils.parseEther('100'), moment().add('30', 'minutes').unix());
      });
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.connect(tradesModifier).mergePendingTrades(1, [2])).to.be.revertedWith('InvalidTrade()');
      });
    });
    when('arguments are vallid', () => {
      let mergeTx: TransactionResponse;
      given(async () => {
        await create({
          tokenIn,
          tokenOut,
          amountIn: amountIn2,
          deadline,
        });
        await create({
          tokenIn,
          tokenOut,
          amountIn: amountIn3,
          deadline,
        });
        mergeTx = await positionsHandler.connect(tradesModifier).mergePendingTrades(1, [2, 3]);
      });
      then('anchor trade amount in its the aggregation of merged trades', async () => {
        expect((await positionsHandler.pendingTradesById(1))._amountIn).to.be.equal(amountIn1.add(amountIn2).add(amountIn3));
      });
      then('all merged trades are removed from pending trades by strategy', async () => {
        expect(await positionsHandler['pendingTradesIds(address)'](strategy.address)).to.not.include([2, 3]);
      });
      then('all merged trades are removed from pending trades by id', async () => {
        expect((await positionsHandler.pendingTradesById(2))._id).to.equal(constants.Zero);
      });
      then('all merged trades are removed from pending trades array', async () => {
        expect(await positionsHandler['pendingTradesIds()']()).to.not.include([2, 3]);
      });
      then('emits event', async () => {
        await expect(mergeTx).to.emit(positionsHandler, 'TradesMerged').withArgs(1, [2, 3]);
      });
    });
  });

  describe('_removePendingTrade', () => {
    when('pending trade exists', () => {
      let tradeId: BigNumber;
      given(async () => {
        ({ id: tradeId } = await create({
          tokenIn: wallet.generateRandomAddress(),
          tokenOut: wallet.generateRandomAddress(),
          amountIn: utils.parseEther('100'),
          deadline: moment().add('30', 'minutes').unix(),
        }));
        await positionsHandler.removePendingTrade(strategy.address, tradeId);
      });
      then('removes trade from trades', async () => {
        expect((await positionsHandler.pendingTradesById(tradeId))._id).to.equal(0);
      });
      then(`removes trade from pending strategy's trade`, async () => {
        expect(await positionsHandler['pendingTradesIds(address)'](strategy.address)).to.be.empty;
      });
      then('removes trade from pending trades ids', async () => {
        expect(await positionsHandler['pendingTradesIds()']()).to.be.empty;
      });
    });
  });

  async function create({
    tokenIn,
    tokenOut,
    amountIn,
    deadline,
  }: {
    tokenIn: string;
    tokenOut: string;
    amountIn: BigNumber;
    deadline: number;
  }): Promise<{ tx: TransactionResponse; id: BigNumber }> {
    const tx = await positionsHandler.connect(strategy).create(tokenIn, tokenOut, amountIn, deadline);
    const txReceipt = await tx.wait();
    const parsedEvent = positionsHandler.interface.parseLog(txReceipt.logs[0]);
    return { tx, id: parsedEvent.args._id };
  }
});
