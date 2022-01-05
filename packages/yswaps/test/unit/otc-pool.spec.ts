import { ethers } from 'hardhat';
import { evm } from '@test-utils';
import { contract, then, when } from '@test-utils/bdd';
import { OTCPool, OTCPool__factory } from '@typechained';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

contract('OTCPool', () => {
  let governor: SignerWithAddress;
  let tradeFactory: SignerWithAddress;
  let otcPoolFactory: OTCPool__factory;
  let otcPool: OTCPool;
  let snapshotId: string;

  before(async () => {
    [governor, tradeFactory] = await ethers.getSigners();
    otcPoolFactory = await ethers.getContractFactory<OTCPool__factory>('contracts/OTCPool.sol:OTCPool');
    otcPool = await otcPoolFactory.deploy(governor.address, tradeFactory.address);
    snapshotId = await evm.snapshot.take();
  });

  beforeEach(async () => {
    await evm.snapshot.revert(snapshotId);
  });

  describe('constructor', () => {
    when('trade factory is zero address', () => {
      then('tx is reverted with reason');
    });
    when('all arguments are valid', () => {
      then('governor is set correctly');
      then('trade factory is set correctly');
    });
  });

  describe('setTradeFactory', () => {
    // ONLY GOVERNOR
    when('trade factory is zero address', () => {
      then('tx is reverted with reason');
    });
    when('trade factory is valid address', () => {
      then('trade factory is set');
      then('emits event');
    });
  });

  describe('create', () => {
    // ONLY GOVERNOR
    when('trade factory is zero address', () => {
      then('tx is reverted with reason');
    });
    when('amount is zero', () => {
      then('tx is reverted with reason');
    });
    when('otc pool doesnt have allowance for offers', () => {
      then('tx is reverted with reason');
    });
    when('arguments are valid', () => {
      then('offer for that token gets increased');
      then('event is emitted');
    });
  });

  describe('take', () => {
    // ONLY TRADE FACTORY
    when('executed', () => {
      then('takes wanted token and amount from governor');
      then('wanted token and amount gets sent to receiver');
      then('offer for wanted token gets reduced');
      then('event is emitted');
    });
  });

  describe('sendDust', () => {
    // only governor
  });
});
