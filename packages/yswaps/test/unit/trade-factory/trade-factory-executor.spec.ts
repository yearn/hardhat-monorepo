import { Contract } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { abi as machineryABI } from '@yearn/contract-utils/artifacts/contracts/interfaces/utils/IMachinery.sol/IMachinery.json';
import { abi as IERC20ABI } from '@artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json';
import { abi as asyncSwapperABI } from '@artifacts/contracts/swappers/async/AsyncSwapper.sol/IAsyncSwapper.json';
import { abi as syncSwapperABI } from '@artifacts/contracts/swappers/sync/SyncSwapper.sol/ISyncSwapper.json';
import { abi as otcPoolABI } from '@artifacts/contracts/OTCPool.sol/IOTCPool.json';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { contract, given, then, when } from '@test-utils/bdd';
import { evm, wallet, contracts, erc20 } from '@test-utils';
import { BigNumber, constants, utils, Wallet } from 'ethers';
import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import {
  AsyncSwapper,
  IERC20,
  Machinery,
  OTCPool,
  Swapper,
  SyncSwapper,
  TradeFactoryExecutorMock,
  TradeFactoryExecutorMock__factory,
} from '@typechained';
import moment from 'moment';
import { TokenContract } from '@test-utils/erc20';

chai.use(smock.matchers);

contract('TradeFactoryExecutor', () => {
  let masterAdmin: SignerWithAddress;
  let strategy: SignerWithAddress;
  let swapperAdder: SignerWithAddress;
  let swapperSetter: SignerWithAddress;
  let strategyAdder: SignerWithAddress;
  let tradeModifier: SignerWithAddress;
  let tradeSettler: SignerWithAddress;
  let mechanic: SignerWithAddress;
  let machinery: FakeContract<Machinery>;
  let asyncSwapper: FakeContract<AsyncSwapper>;
  let syncSwapper: FakeContract<SyncSwapper>;
  let otcPool: FakeContract<OTCPool>;
  let executorFactory: MockContractFactory<TradeFactoryExecutorMock__factory>;
  let executor: MockContract<TradeFactoryExecutorMock>;
  let token: TokenContract;
  let snapshotId: string;

  before(async () => {
    [masterAdmin, swapperAdder, swapperSetter, strategyAdder, tradeModifier, tradeSettler, strategy, mechanic] = await ethers.getSigners();
    executorFactory = await smock.mock<TradeFactoryExecutorMock__factory>(
      'contracts/mock/TradeFactory/TradeFactoryExecutor.sol:TradeFactoryExecutorMock',
      mechanic
    );
    machinery = await smock.fake<Machinery>(machineryABI);
    asyncSwapper = await smock.fake<AsyncSwapper>(asyncSwapperABI);
    syncSwapper = await smock.fake<SyncSwapper>(syncSwapperABI);
    otcPool = await smock.fake<OTCPool>(otcPoolABI);
    executor = await executorFactory.deploy(
      masterAdmin.address,
      swapperAdder.address,
      swapperSetter.address,
      strategyAdder.address,
      tradeModifier.address,
      tradeSettler.address,
      machinery.address
    );
    token = await erc20.deploy({
      symbol: 'TK',
      name: 'Token',
      initialAccount: strategy.address,
      initialAmount: utils.parseEther('10000'),
    });
    await executor.connect(strategyAdder).grantRole(await executor.STRATEGY(), strategy.address);
    await executor.connect(swapperAdder).addSwappers([asyncSwapper.address, syncSwapper.address]);
    await executor.connect(masterAdmin).setOTCPool(otcPool.address);
    machinery.isMechanic.returns(true);
    asyncSwapper.SWAPPER_TYPE.returns(0);
    syncSwapper.SWAPPER_TYPE.returns(1);
    await executor.connect(swapperSetter).setStrategySyncSwapper(strategy.address, syncSwapper.address);
    snapshotId = await evm.snapshot.take();
  });

  beforeEach(async () => {
    await evm.snapshot.revert(snapshotId);
  });

  describe('constructor', () => {});

  describe('execute sync', () => {
    const amountIn = utils.parseEther('100');
    const tokenOut = wallet.generateRandomAddress();
    const maxSlippage = BigNumber.from('1000');
    const data = ethers.utils.defaultAbiCoder.encode([], []);
    // TODO: ONLY STRATEGY
    when('token in is zero address', () => {
      then('tx is reverted with reason', async () => {
        await expect(
          executor
            .connect(strategy)
            ['execute(address,address,uint256,uint256,bytes)'](constants.AddressZero, tokenOut, amountIn, maxSlippage, data)
        ).to.be.revertedWith('ZeroAddress()');
      });
    });
    when('token out is zero address', () => {
      then('tx is reverted with reason', async () => {
        await expect(
          executor
            .connect(strategy)
            ['execute(address,address,uint256,uint256,bytes)'](token.address, constants.AddressZero, amountIn, maxSlippage, data)
        ).to.be.revertedWith('ZeroAddress()');
      });
    });
    when('amount in is zero', () => {
      then('tx is reverted with reason', async () => {
        await expect(
          executor
            .connect(strategy)
            ['execute(address,address,uint256,uint256,bytes)'](token.address, tokenOut, constants.Zero, maxSlippage, data)
        ).to.be.revertedWith('ZeroAmount()');
      });
    });
    when('max slippage is zero', () => {
      then('tx is reverted with reason', async () => {
        await expect(
          executor.connect(strategy)['execute(address,address,uint256,uint256,bytes)'](token.address, tokenOut, amountIn, constants.Zero, data)
        ).to.be.revertedWith('ZeroSlippage()');
      });
    });
    when('is not the first trade being executed of token in & swapper', async () => {
      let executeTx: TransactionResponse;
      let initialStrategyBalance: BigNumber;
      let initialSwapperBalance: BigNumber;
      const receivedAmount = utils.parseEther('92356');
      given(async () => {
        syncSwapper.swap.returns(receivedAmount);
        initialStrategyBalance = await token.balanceOf(strategy.address);
        initialSwapperBalance = await token.balanceOf(syncSwapper.address);
        await token.connect(strategy).approve(executor.address, amountIn);
        executeTx = await executor
          .connect(strategy)
          ['execute(address,address,uint256,uint256,bytes)'](token.address, tokenOut, amountIn, maxSlippage, data);
      });
      then('approve from strategy to trade factory gets reduced', async () => {
        expect(await token.allowance(strategy.address, syncSwapper.address)).to.be.equal(0);
      });
      then('funds get taken from strategy', async () => {
        expect(await token.balanceOf(strategy.address)).to.equal(initialStrategyBalance.sub(amountIn));
      });
      then('moves funds from strategy to swapper', async () => {
        expect(await token.balanceOf(syncSwapper.address)).to.equal(initialSwapperBalance.add(amountIn));
      });
      then('calls swapper swap with correct data', () => {
        expect(syncSwapper.swap).to.have.been.calledWith(strategy.address, token.address, tokenOut, amountIn, maxSlippage, data);
      });
      then('emits event', async () => {
        await expect(executeTx)
          .to.emit(executor, 'SyncTradeExecuted')
          .withArgs(strategy.address, syncSwapper.address, token.address, tokenOut, amountIn, maxSlippage, data, receivedAmount);
      });
    });
  });

  describe('execute async', () => {
    let tradeId: BigNumber;
    const amountIn = utils.parseEther('100');
    const deadline = moment().add('30', 'minutes').unix();
    const tokenOut = wallet.generateRandomAddress();
    const minAmountOut = BigNumber.from('1000');
    const data = contracts.encodeParameters([], []);
    given(async () => {
      ({ id: tradeId } = await create({
        tokenIn: token.address,
        tokenOut,
        amountIn,
        deadline,
      }));
    });
    // TODO: Only mechanic
    when('executing a trade thats not pending', () => {
      then('tx is reverted with reason', async () => {
        await expect(
          executor['execute(uint256,address,uint256,bytes)'](tradeId.add(1), asyncSwapper.address, minAmountOut, data)
        ).to.be.revertedWith('InvalidTrade()');
      });
    });
    when('trade has expired', () => {
      given(async () => {
        await evm.advanceToTimeAndBlock(deadline + 1);
      });
      then('tx is reverted with reason', async () => {
        await expect(executor['execute(uint256,address,uint256,bytes)'](tradeId, asyncSwapper.address, minAmountOut, data)).to.be.revertedWith(
          'ExpiredTrade()'
        );
      });
    });
    when('executing a trade where swapper has been removed', () => {
      given(async () => {
        await executor.connect(swapperAdder).removeSwappers([asyncSwapper.address]);
      });
      then('tx is reverted with reason', async () => {
        await expect(executor['execute(uint256,address,uint256,bytes)'](tradeId, asyncSwapper.address, minAmountOut, data)).to.be.revertedWith(
          'InvalidSwapper()'
        );
      });
    });
    when('is not the first trade being executed of token in & swapper', () => {
      let executeTx: TransactionResponse;
      let initialStrategyBalance: BigNumber;
      let initialSwapperBalance: BigNumber;
      const receivedAmount = utils.parseEther('92356');
      given(async () => {
        asyncSwapper.swap.returns(receivedAmount);
        initialStrategyBalance = await token.balanceOf(strategy.address);
        initialSwapperBalance = await token.balanceOf(asyncSwapper.address);
        executeTx = await executor['execute(uint256,address,uint256,bytes)'](tradeId, asyncSwapper.address, minAmountOut, data);
      });
      then('approve from strategy to trade factory gets reduced', async () => {
        expect(await token.allowance(strategy.address, asyncSwapper.address)).to.be.equal(0);
      });
      then('funds get taken from strategy', async () => {
        expect(await token.balanceOf(strategy.address)).to.equal(initialStrategyBalance.sub(amountIn));
      });
      then('moves funds from strategy to swapper', async () => {
        expect(await token.balanceOf(asyncSwapper.address)).to.equal(initialSwapperBalance.add(amountIn));
      });
      then('calls swapper swap with correct data', () => {
        expect(asyncSwapper.swap).to.have.been.calledWith(strategy.address, token.address, tokenOut, amountIn, minAmountOut, data);
      });
      then('removes trades from trades', async () => {
        expect(await executor.pendingTradesById(tradeId))
          .to.haveOwnProperty('_id')
          .to.equal(0);
      });
      then("removes trades from pending strategy's trade", async () => {
        expect(await executor['pendingTradesIds(address)'](strategy.address)).to.be.empty;
      });
      then('removes trades from pending trades ids', async () => {
        expect(await executor['pendingTradesIds()']()).to.be.empty;
      });
      then('emits event', async () => {
        await expect(executeTx).to.emit(executor, 'AsyncTradeExecuted').withArgs(tradeId, receivedAmount);
      });
    });
  });

  describe('expire', () => {
    let tradeId: BigNumber;
    const amountIn = utils.parseEther('100');
    given(async () => {
      ({ id: tradeId } = await create({
        tokenIn: token.address,
        tokenOut: wallet.generateRandomAddress(),
        amountIn,
        deadline: moment().add('30', 'minutes').unix(),
      }));
    });
    // TODO: Only mechanic
    when('expiring a trade thats not pending', () => {
      then('tx is reverted with reason', async () => {
        await expect(executor.expire(tradeId.add(1))).to.be.revertedWith('InvalidTrade()');
      });
    });
    when('trade has not expired', () => {
      then('tx is reverted with reason', async () => {
        await expect(executor.expire(tradeId)).to.be.revertedWith('OngoingTrade()');
      });
    });
    when('trade can be expired', () => {
      let expireTx: TransactionResponse;
      given(async () => {
        await evm.advanceToTimeAndBlock(moment().add('100', 'hours').unix());
        expireTx = await executor.expire(tradeId);
      });
      then('reduces allowance from strategy to trade factory', async () => {
        expect(await token.allowance(strategy.address, executor.address)).to.be.equal(0);
      });
      then('removes trades from trades', async () => {
        expect(await executor.pendingTradesById(tradeId))
          .to.haveOwnProperty('_id')
          .to.equal(0);
      });
      then("removes trades from pending strategy's trade", async () => {
        expect(await executor['pendingTradesIds(address)'](strategy.address)).to.be.empty;
      });
      then('removes trades from pending trades ids', async () => {
        expect(await executor['pendingTradesIds()']()).to.be.empty;
      });
      then('emits event', async () => {
        await expect(expireTx).to.emit(executor, 'AsyncTradeExpired').withArgs(tradeId);
      });
    });
  });

  describe('execute async trade against trade', () => {
    let otherStrat: Wallet;
    let tokenOut: Contract;
    let firstTrade: any;
    let secondTrade: any;
    given(async () => {
      otherStrat = await wallet.generateRandom();
      tokenOut = await erc20.deploy({
        symbol: 'TKO',
        name: 'Token out',
        initialAccount: otherStrat.address,
        initialAmount: utils.parseEther('10000'),
      });
      await executor.connect(strategyAdder).grantRole(await executor.STRATEGY(), otherStrat.address);
      // Enable COW for both strategies
      await executor.connect(swapperSetter).setStrategyPermissions(strategy.address, '0x02');
      await executor.connect(swapperSetter).setStrategyPermissions(otherStrat.address, '0x02');
      firstTrade = {
        amountIn: utils.parseEther('100'),
        tokenIn: token.address,
        tokenOut: tokenOut.address,
        deadline: moment().add('30', 'minutes').unix(),
      };
      secondTrade = {
        amountIn: utils.parseEther('100'),
        tokenIn: tokenOut.address,
        tokenOut: token.address,
        deadline: moment().add('30', 'minutes').unix(),
      };
      // ID: 1
      await token.connect(strategy).approve(executor.address, firstTrade.amountIn);
      await executor.connect(strategy).create(firstTrade.tokenIn, firstTrade.tokenOut, firstTrade.amountIn, firstTrade.deadline);
      // ID: 2
      await tokenOut.connect(otherStrat).approve(executor.address, secondTrade.amountIn);
      await executor.connect(otherStrat).create(secondTrade.tokenIn, secondTrade.tokenOut, secondTrade.amountIn, secondTrade.deadline);
    });
    when('trades have different token in than token out', () => {
      given(async () => {
        await executor.connect(otherStrat).create(wallet.generateRandomAddress(), firstTrade.tokenOut, firstTrade.amountIn, firstTrade.deadline);
      });
      then('tx is reverted with reason', async () => {
        await expect(executor.connect(tradeSettler)['execute(uint256,uint256,uint256,uint256)'](3, 2, 0, 0)).to.be.revertedWith(
          'InvalidTrade()'
        );
      });
    });
    when('trades have different token out than token in', () => {
      given(async () => {
        await executor.connect(otherStrat).create(firstTrade.tokenIn, wallet.generateRandomAddress(), firstTrade.amountIn, firstTrade.deadline);
      });
      then('tx is reverted with reason', async () => {
        await expect(executor.connect(tradeSettler)['execute(uint256,uint256,uint256,uint256)'](3, 2, 0, 0)).to.be.revertedWith(
          'InvalidTrade()'
        );
      });
    });
    when('first trade has expired', () => {
      given(async () => {
        await executor
          .connect(otherStrat)
          .create(firstTrade.tokenIn, firstTrade.tokenOut, firstTrade.amountIn, moment().add('1', 'minutes').unix());
        await evm.advanceToTimeAndBlock(moment().add('2', 'minutes').unix());
      });
      then('tx is reverted with reason', async () => {
        await expect(executor.connect(tradeSettler)['execute(uint256,uint256,uint256,uint256)'](3, 2, 0, 0)).to.be.revertedWith(
          'ExpiredTrade()'
        );
      });
    });
    when('against trade has expired', () => {
      given(async () => {
        await executor
          .connect(otherStrat)
          .create(secondTrade.tokenIn, secondTrade.tokenOut, secondTrade.amountIn, moment().add('1', 'minutes').unix());
        await evm.advanceToTimeAndBlock(moment().add('2', 'minutes').unix());
      });
      then('tx is reverted with reason', async () => {
        await expect(executor.connect(tradeSettler)['execute(uint256,uint256,uint256,uint256)'](1, 3, 0, 0)).to.be.revertedWith(
          'ExpiredTrade()'
        );
      });
    });
    when(`first trade's strategy doesnt have COW enabled`, () => {
      given(async () => {
        await executor.connect(swapperSetter).setStrategyPermissions(strategy.address, '0x01');
      });
      then('tx is reverted with reason', async () => {
        await expect(executor.connect(tradeSettler)['execute(uint256,uint256,uint256,uint256)'](1, 2, 0, 0)).to.be.revertedWith(
          'NotAuthorized()'
        );
      });
    });
    when(`second trade's strategy doesnt have COW enabled`, () => {
      given(async () => {
        await executor.connect(swapperSetter).setStrategyPermissions(otherStrat.address, '0x01');
      });
      then('tx is reverted with reason', async () => {
        await expect(executor.connect(tradeSettler)['execute(uint256,uint256,uint256,uint256)'](1, 2, 0, 0)).to.be.revertedWith(
          'NotAuthorized()'
        );
      });
    });
  });

  describe('execute otc', () => {
    const amountIn = utils.parseEther('100');
    const deadline = moment().add('30', 'minutes').unix();
    const tokenOut = wallet.generateRandomAddress();
    const governor = wallet.generateRandomAddress();
    given(async () => {
      otcPool.governor.returns(governor);
      await executor.connect(swapperSetter).setStrategyPermissions(strategy.address, [1]);
      await create({
        tokenIn: token.address,
        tokenOut,
        amountIn,
        deadline,
      });
    });
    // TODO: Only mechanic
    when('executing a trade that is not pending', () => {
      then('tx is reverted', async () => {
        await expect(executor['execute(uint256[],uint256)']([2], 1)).to.be.reverted;
      });
    });
    when('executing trades with zero rate', () => {
      then('tx is reverted with reason', async () => {
        await expect(executor['execute(uint256[],uint256)']([1], 0)).to.be.revertedWith('ZeroRate()');
      });
    });
    when('some trades being executed have different token in', () => {
      given(async () => {
        const tokenIn = await smock.fake<IERC20>(IERC20ABI);
        await create({
          tokenIn: tokenIn.address,
          tokenOut,
          amountIn,
          deadline,
        });
      });
      then('tx is reverted with reason', async () => {
        await expect(executor['execute(uint256[],uint256)']([1, 2], 1)).to.be.revertedWith('InvalidTrade()');
      });
    });
    when('some trades being executed have different token out', () => {
      given(async () => {
        await create({
          tokenIn: token.address,
          tokenOut: (await smock.fake<IERC20>(IERC20ABI)).address,
          amountIn,
          deadline,
        });
      });
      then('tx is reverted with reason', async () => {
        await expect(executor['execute(uint256[],uint256)']([1, 2], 1)).to.be.revertedWith('InvalidTrade()');
      });
    });
    when('a trade has expired', () => {
      given(async () => {
        await evm.advanceToTimeAndBlock(deadline + 1);
      });
      then('tx is reverted with reason', async () => {
        await expect(executor['execute(uint256[],uint256)']([1], 1)).to.be.revertedWith('ExpiredTrade()');
      });
    });
    when('trade strategy did not have OTC enabled', () => {
      given(async () => {
        await executor.connect(swapperSetter).setStrategyPermissions(strategy.address, [0]);
      });
      then('tx is reverted with reason', async () => {
        await expect(executor['execute(uint256[],uint256)']([1], 1)).to.be.revertedWith('NotAuthorized()');
      });
    });
    when('safe transfer to governor reverts', () => {
      given(async () => {
        await token.connect(strategy).approve(executor.address, 0);
      });
      then('tx is reverted', async () => {
        await expect(executor['execute(uint256[],uint256)']([2], 1)).to.be.reverted;
      });
    });
    when.skip('taking funds from otc pool reverts', () => {
      given(async () => {
        otcPool.take.returns('take error');
      });
      then('tx is reverted', async () => {
        await expect(executor['execute(uint256[],uint256)']([1], 1)).to.be.revertedWith('take error');
      });
    });
    when('arguments are valid', () => {
      let executeTx: TransactionResponse;
      const rate = utils.parseEther('0.5');
      given(async () => {
        await otcPool.take.reset();
        await create({
          tokenIn: token.address,
          tokenOut,
          amountIn,
          deadline,
        });
        executeTx = await executor['execute(uint256[],uint256)']([1, 2], rate);
      });
      then('all funds of trades are sent to otc pool governor', async () => {
        expect(await token.balanceOf(governor)).to.be.equal(amountIn.mul(2));
      });
      then('otc pool take is called correctly', async () => {
        expect(otcPool.take.atCall(0)).to.have.been.calledWith(tokenOut, amountIn.div(2).toString(), strategy.address);
        // expect(otcPool.take.atCall(1)).to.have.been.calledWith(tokenOut, amountIn.div(2).toString(), strategy.address);
      });
      then('all trades get removed', async () => {
        expect(await executor.pendingTradesById(1))
          .to.haveOwnProperty('_id')
          .to.equal(0);
        expect(await executor.pendingTradesById(2))
          .to.haveOwnProperty('_id')
          .to.equal(0);
      });
      then('emits event with correct information', async () => {
        await expect(executeTx).to.emit(executor, 'AsyncOTCTradesExecuted').withArgs([1, 2], rate);
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
    await token.connect(strategy).increaseAllowance(executor.address, amountIn);
    const tx = await executor.connect(strategy).create(tokenIn, tokenOut, amountIn, deadline);
    const txReceipt = await tx.wait();
    const parsedEvent = executor.interface.parseLog(txReceipt.logs[0]);
    return { tx, id: parsedEvent.args._id };
  }
});
