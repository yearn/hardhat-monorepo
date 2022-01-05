import { BigNumber, constants, Contract, PopulatedTransaction, utils } from 'ethers';
import { ethers } from 'hardhat';
import moment from 'moment';
import { erc20, evm } from '@test-utils';
import * as fixtures from '../../../fixtures';
import { contract, given, then } from '@test-utils/bdd';
import { expect } from 'chai';
import { IERC20, TradeFactory } from '@typechained';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { mergeTransactions } from '@scripts/libraries/multicall';

contract('MultiCallOptimizedSwapper', () => {
  let masterAdmin: SignerWithAddress;
  let mechanic: SignerWithAddress;
  let strategy: SignerWithAddress;
  let hodler: SignerWithAddress;
  let swapperAdder: SignerWithAddress;
  let swapperSetter: SignerWithAddress;
  let strategyAdder: SignerWithAddress;
  let tradeModifier: SignerWithAddress;
  let tradeSettler: SignerWithAddress;
  let otcPoolGovernor: SignerWithAddress;

  let tokenIn: IERC20;
  let tokenOut: IERC20;

  let mechanicsRegistry: Contract;
  let tradeFactory: TradeFactory;

  let multiCallOptimizedAsyncSwapper: Contract;

  let snapshotId: string;

  const amountIn = utils.parseEther('10');

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
      hodler,
      swapperSetter,
      otcPoolGovernor,
    ] = await ethers.getSigners();

    ({ mechanicsRegistry } = await fixtures.machineryFixture(mechanic.address));

    ({ tradeFactory, multiCallOptimizedAsyncSwapper } = await fixtures.multiCallOptimizedSwapperFixture(
      masterAdmin.address,
      swapperAdder.address,
      swapperSetter.address,
      strategyAdder.address,
      tradeModifier.address,
      tradeSettler.address,
      mechanicsRegistry.address,
      otcPoolGovernor.address
    ));

    await tradeFactory.connect(strategyAdder).grantRole(await tradeFactory.STRATEGY(), strategy.address);
    await tradeFactory.connect(swapperAdder).addSwappers([multiCallOptimizedAsyncSwapper.address]);

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

    await tokenIn.connect(hodler).transfer(strategy.address, amountIn);
    await tokenIn.connect(strategy).approve(tradeFactory.address, amountIn);

    // allows amount out just for extra complexity
    await tokenOut.connect(hodler).approve(multiCallOptimizedAsyncSwapper.address, 2);

    snapshotId = await evm.snapshot.take();
  });

  beforeEach(async () => {
    await evm.snapshot.revert(snapshotId);
  });

  describe('swap', () => {
    let minAmountOut: BigNumber;
    given(async () => {
      await tradeFactory.connect(strategy).create(tokenIn.address, tokenOut.address, amountIn, moment().add('30', 'minutes').unix());
      const transactions: PopulatedTransaction[] = [];
      // swapper has tokenIn, it sends it all to the holder
      transactions.push(await tokenIn.populateTransaction.transfer(hodler.address, amountIn));
      // swapper grabs allowance (2) of tokenOut from holder to itself
      transactions.push(await tokenOut.populateTransaction.transferFrom(hodler.address, multiCallOptimizedAsyncSwapper.address, 2));
      // swapper sends tokenOut (2) to strategy as the trade output
      transactions.push(await tokenOut.populateTransaction.transfer(strategy.address, 2));

      minAmountOut = BigNumber.from(1);

      const tx = tradeFactory
        .connect(mechanic)
        ['execute(uint256,address,uint256,bytes)'](
          1,
          multiCallOptimizedAsyncSwapper.address,
          minAmountOut,
          mergeTransactions([await tokenIn.populateTransaction.transfer(hodler.address, amountIn.add(1))])
        );
      await expect(tx).to.be.revertedWith('MultiCallRevert()');

      await tradeFactory
        .connect(mechanic)
        ['execute(uint256,address,uint256,bytes)'](1, multiCallOptimizedAsyncSwapper.address, minAmountOut, mergeTransactions(transactions));
    });
    then('tokens in gets taken from strategy', async () => {
      expect(await tokenIn.balanceOf(strategy.address)).to.equal(0);
    });
    then('token out gets airdropped to strategy', async () => {
      expect(await tokenOut.balanceOf(strategy.address)).to.be.gte(minAmountOut);
    });
  });
});
