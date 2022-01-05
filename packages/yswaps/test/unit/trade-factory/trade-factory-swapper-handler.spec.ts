import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { evm, wallet } from '@test-utils';
import { contract, given, then, when } from '@test-utils/bdd';
import { constants } from 'ethers';
import { TradeFactorySwapperHandlerMock, TradeFactorySwapperHandlerMock__factory } from '@typechained';

contract('TradeFactorySwapperHandler', () => {
  let masterAdmin: SignerWithAddress;
  let swapperAdder: SignerWithAddress;
  let swapperSetter: SignerWithAddress;

  let tradeFactoryFactory: TradeFactorySwapperHandlerMock__factory;
  let tradeFactory: TradeFactorySwapperHandlerMock;

  let snapshotId: string;

  before(async () => {
    [masterAdmin, swapperAdder, swapperSetter] = await ethers.getSigners();
    tradeFactoryFactory = await ethers.getContractFactory<TradeFactorySwapperHandlerMock__factory>(
      'contracts/mock/TradeFactory/TradeFactorySwapperHandler.sol:TradeFactorySwapperHandlerMock'
    );
    tradeFactory = await tradeFactoryFactory.deploy(masterAdmin.address, swapperAdder.address, swapperSetter.address);
    snapshotId = await evm.snapshot.take();
  });

  beforeEach(async () => {
    await evm.snapshot.revert(snapshotId);
  });

  describe('constructor', () => {
    when('swapper adder is zero address', () => {
      then('tx is reverted with message');
    });
    when('swapper setter is zero address', () => {
      then('tx is reverted with message');
    });
    when('all arguments are valid', () => {
      then('role admin of SWAPPER_ADDER is MASTER_ADMIN');
      then('role admin of SWAPPER_SETTER is MASTER_ADMIN');
      then('SWAPPER_ADDER is set correctly');
      then('SWAPPER_SETTER is set correctly');
    });
  });

  describe('swappers', () => {
    when('there are no swappers', () => {
      then('returns empty array', async () => {
        expect(await tradeFactory.swappers()).to.be.empty;
      });
    });
    when('there are swappers', () => {
      let swappers: string[];
      given(async () => {
        swappers = [wallet.generateRandomAddress(), wallet.generateRandomAddress(), wallet.generateRandomAddress()];
        await tradeFactory.connect(swapperAdder).addSwappers(swappers);
      });
      then('returns array with correct swappers', async () => {
        expect(await tradeFactory.swappers()).to.eql(swappers);
      });
    });
  });

  describe('swappers', () => {
    when('there are no swappers', () => {
      then('returns empty array', async () => {
        expect(await tradeFactory.swappers()).to.be.empty;
      });
    });
    when('there are swappers', () => {
      let swappers: string[];
      given(async () => {
        swappers = [wallet.generateRandomAddress(), wallet.generateRandomAddress(), wallet.generateRandomAddress()];
        await tradeFactory.connect(swapperAdder).addSwappers(swappers);
      });
      then('returns array with correct swappers', async () => {
        expect(await tradeFactory.swappers()).to.eql(swappers);
      });
    });
  });

  describe('isSwapper', () => {
    when('is not a swapper', () => {
      then('returns false', async () => {
        expect(await tradeFactory.isSwapper(wallet.generateRandomAddress())).to.be.false;
      });
    });
    when('is a swapper', () => {
      let swapper: string;
      given(async () => {
        swapper = wallet.generateRandomAddress();
        await tradeFactory.connect(swapperAdder).addSwappers([swapper]);
      });
      then('returns true', async () => {
        expect(await tradeFactory.isSwapper(swapper)).to.be.true;
      });
    });
  });

  describe('swapperStrategies', () => {
    when('there are no strategies assigned to swapper', () => {
      then('returns empty array');
    });
    when('there are strategies assigned to swapper', () => {
      then('returns array of strategies');
    });
  });

  describe('setStrategyPermissions', () => {
    // ONLY SWAPPER SETTER
    when('strategy is zero address', () => {
      then('tx is reverted with message');
    });
    when('arguments are valid', () => {
      then('sets strategy permissions');
      then('emits event');
    });
  });

  describe('setOTCPool', () => {
    // ONLY MASTER ADMIN
    when('otc pool is zero address', () => {
      then('tx is reverted with message');
    });
    when('arguments are valid', () => {
      then('sets otc pool');
      then('emits event');
    });
  });

  describe('setStrategySyncSwapper', () => {
    // ONLY SWAPPER SETTER
    when('strategy is zero address', () => {
      then('tx is reverted with message');
    });
    when('swapper is zero address', () => {
      then('tx is reverted with message');
    });
    when('trying to set an async swapper', () => {
      then('tx is reverted with message');
    });
    when('swapper is not an added swapper', () => {
      then('tx is reverted with message');
    });
    when(`strategy didn't have any sync swapper set`, () => {
      then('sets sync swapper of strategy');
      then('adds strategy to swapper strategies');
      then('emits event');
    });
    when('strategy had a sync swapper set', () => {
      then('removes strategy from old swapper strategies');
      then('sets sync swapper of strategy');
      then('adds strategy to swapper strategies');
      then('emits event');
    });
  });

  describe('addSwappers', () => {
    // ONLY SWAPPER ADDER
    when('adding swappers with zero address', () => {
      let addSwappersTx: Promise<TransactionResponse>;
      given(async () => {
        addSwappersTx = tradeFactory.connect(swapperAdder).addSwappers([constants.AddressZero]);
      });
      then('tx is reverted with reason', async () => {
        await expect(addSwappersTx).to.be.revertedWith('ZeroAddress()');
      });
    });
    when('swapper was already added', () => {
      const swapper: string = wallet.generateRandomAddress();
      given(async () => {
        await tradeFactory.connect(swapperAdder).addSwappers([swapper]);
        await tradeFactory.connect(swapperAdder).addSwappers([swapper]);
      });
      then('does not change swappers', async () => {
        expect(await tradeFactory.swappers()).to.eql([swapper]);
      });
    });
    when('adding valid swapper', () => {
      const swappers = [wallet.generateRandomAddress(), wallet.generateRandomAddress()];
      let addSwapperTx: TransactionResponse;
      given(async () => {
        addSwapperTx = await tradeFactory.connect(swapperAdder).addSwappers(swappers);
      });
      then('gets added to swappers', async () => {
        expect(await tradeFactory.isSwapper(swappers[0])).to.be.true;
        expect(await tradeFactory.isSwapper(swappers[1])).to.be.true;
      });
      then('emits event with correct information', async () => {
        await expect(addSwapperTx).to.emit(tradeFactory, 'SwappersAdded').withArgs(swappers);
      });
    });
  });

  describe('removeSwappers', () => {
    const swappers = [wallet.generateRandomAddress(), wallet.generateRandomAddress()];
    given(async () => {
      await tradeFactory.connect(swapperAdder).addSwappers(swappers);
    });
    // only SWAPPER_ADDER
    when('swapper was not in registry', () => {
      let removeSwappersTx: Promise<TransactionResponse>;
      given(async () => {
        removeSwappersTx = tradeFactory.connect(swapperAdder).removeSwappers([wallet.generateRandomAddress()]);
      });
      then('tx is not reverted', async () => {
        await expect(removeSwappersTx).to.not.be.reverted;
      });
    });
    when('swapper is assigned to a strategy', () => {
      let removeSwappersTx: Promise<TransactionResponse>;
      given(async () => {
        await tradeFactory.connect(swapperSetter).addSwapperToStrategyInternal(swappers[0], wallet.generateRandomAddress());
        removeSwappersTx = tradeFactory.connect(swapperAdder).removeSwappers(swappers);
      });
      then('tx is reverted with message', async () => {
        await expect(removeSwappersTx).to.be.revertedWith('SwapperInUse()');
      });
    });
    when('swapper was in registry', () => {
      let removeSwapperTx: TransactionResponse;
      given(async () => {
        removeSwapperTx = await tradeFactory.connect(swapperAdder).removeSwappers(swappers);
      });
      then('sets removed to true', async () => {
        expect(await tradeFactory.isSwapper(swappers[0])).to.be.false;
        expect(await tradeFactory.isSwapper(swappers[1])).to.be.false;
      });
      then('emits event with correct information', async () => {
        await expect(removeSwapperTx).to.emit(tradeFactory, 'SwappersRemoved').withArgs(swappers);
      });
    });
  });
});
