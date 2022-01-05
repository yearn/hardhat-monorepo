import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { constants, Contract, utils } from 'ethers';
import { ethers } from 'hardhat';
import moment from 'moment';
import { erc20, evm } from '@test-utils';
import * as fixtures from '../../fixtures';
import { contract, given, then } from '@test-utils/bdd';
import { expect } from 'chai';

contract('TradeFactory', () => {
  let masterAdmin: SignerWithAddress;
  let mechanic: SignerWithAddress;
  let strategy: SignerWithAddress;
  let strategy2: SignerWithAddress;
  let hodler: SignerWithAddress;
  let swapperAdder: SignerWithAddress;
  let swapperSetter: SignerWithAddress;
  let strategyAdder: SignerWithAddress;
  let tradeModifier: SignerWithAddress;
  let tradeSettler: SignerWithAddress;
  let otcPoolGovernor: SignerWithAddress;

  let uniswapV2AsyncSwapper: Contract;

  let tokenIn: Contract;
  let tokenOut: Contract;

  let mechanicsRegistry: Contract;
  let tradeFactory: Contract;
  let otcPool: Contract;

  let snapshotId: string;

  const firstTradeAmountIn = utils.parseEther('10');
  const secondTradeAmountIn = utils.parseEther('6.9');

  const offeredByOTC = utils.parseEther('59');

  before('create fixture loader', async () => {
    [
      masterAdmin,
      swapperAdder,
      swapperSetter,
      strategyAdder,
      tradeModifier,
      tradeSettler,
      mechanic,
      strategy,
      strategy2,
      hodler,
      swapperSetter,
      otcPoolGovernor,
    ] = await ethers.getSigners();
    ({ mechanicsRegistry } = await fixtures.machineryFixture(mechanic.address));

    ({ tradeFactory, otcPool, uniswapV2AsyncSwapper } = await fixtures.uniswapV2SwapperFixture(
      masterAdmin.address,
      swapperAdder.address,
      swapperSetter.address,
      strategyAdder.address,
      tradeModifier.address,
      tradeSettler.address,
      mechanicsRegistry.address,
      otcPoolGovernor.address
    ));

    await tradeFactory.connect(swapperAdder).addSwappers([uniswapV2AsyncSwapper.address]);

    await tradeFactory.connect(strategyAdder).grantRole(await tradeFactory.STRATEGY(), strategy.address);
    await tradeFactory.connect(strategyAdder).grantRole(await tradeFactory.STRATEGY(), strategy2.address);

    await tradeFactory.connect(swapperSetter).setStrategyPermissions(strategy.address, [1]);
    await tradeFactory.connect(swapperSetter).setStrategyPermissions(strategy2.address, [1]);

    tokenIn = await erc20.deploy({
      name: 'TA',
      symbol: 'TA',
      initialAccount: hodler.address,
      initialAmount: constants.MaxUint256,
    });

    tokenOut = await erc20.deploy({
      name: 'TB',
      symbol: 'TB',
      initialAccount: hodler.address,
      initialAmount: constants.MaxUint256,
    });

    await tokenIn.connect(hodler).transfer(strategy.address, firstTradeAmountIn);
    await tokenIn.connect(strategy).approve(tradeFactory.address, firstTradeAmountIn);
    await tradeFactory.connect(strategy).create(tokenIn.address, tokenOut.address, firstTradeAmountIn, moment().add('30', 'minutes').unix());

    await tokenIn.connect(hodler).transfer(strategy2.address, secondTradeAmountIn);
    await tokenIn.connect(strategy2).approve(tradeFactory.address, secondTradeAmountIn);
    await tradeFactory.connect(strategy2).create(tokenIn.address, tokenOut.address, secondTradeAmountIn, moment().add('30', 'minutes').unix());

    await tokenOut.connect(hodler).transfer(otcPoolGovernor.address, offeredByOTC);
    await tokenOut.connect(otcPoolGovernor).approve(otcPool.address, offeredByOTC);
    await otcPool.connect(otcPoolGovernor).create(tokenOut.address, offeredByOTC);

    snapshotId = await evm.snapshot.take();
  });

  beforeEach(async () => {
    await evm.snapshot.revert(snapshotId);
  });

  describe('execute otc', () => {
    const consumedOut = firstTradeAmountIn.div(2).add(secondTradeAmountIn.div(2));
    given(async () => {
      await tradeFactory.connect(mechanic)['execute(uint256[],uint256)']([1, 2], utils.parseEther('0.5'));
    });
    then('takes funds from strategies', async () => {
      expect(await tokenIn.balanceOf(strategy.address)).to.equal(0);
      expect(await tokenIn.balanceOf(strategy2.address)).to.equal(0);
    });
    then('sends funds from strategies to otc pool governor', async () => {
      expect(await tokenIn.balanceOf(otcPoolGovernor.address)).to.equal(firstTradeAmountIn.add(secondTradeAmountIn));
    });
    then('takes funds from otc pool governor', async () => {
      expect(await tokenOut.balanceOf(otcPoolGovernor.address)).to.equal(offeredByOTC.sub(consumedOut));
    });
    then('sends funds from otc pool governor to strategies', async () => {
      expect(await tokenOut.balanceOf(strategy.address)).to.equal(firstTradeAmountIn.div(2));
      expect(await tokenOut.balanceOf(strategy2.address)).to.equal(secondTradeAmountIn.div(2));
    });
  });
});
