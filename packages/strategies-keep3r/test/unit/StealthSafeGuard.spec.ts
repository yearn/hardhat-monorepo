import chai, { expect } from 'chai';
import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { Manageable, StealthSafeGuard, StealthSafeGuard__factory } from '@typechained';
import { StealthRelayer } from '@yearn/stealth-txs/typechained';
import ManageableArtifact from '@yearn-mechanics/contract-utils/artifacts/solidity/contracts/utils/Manageable.sol/Manageable.json';
import StealthRelayerArtifact from '@yearn/stealth-txs/artifacts/contracts/StealthRelayer.sol/StealthRelayer.json';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { ZERO_ADDRESS } from 'utils/web3-utils';
import { wallet } from '@test-utils';

chai.use(smock.matchers);

describe('StealthSafeGuard', () => {
  let governor: SignerWithAddress;
  let stealthSafeGuard: MockContract<StealthSafeGuard>;
  let manageable: FakeContract<Manageable>;
  let stealthRelayer: FakeContract<StealthRelayer>;
  let stealthSafeGuardFactory: MockContractFactory<StealthSafeGuard__factory>;

  before(async () => {
    [governor] = await ethers.getSigners();
    stealthSafeGuardFactory = await smock.mock('StealthSafeGuard');
  });

  beforeEach(async () => {
    manageable = await smock.fake(ManageableArtifact);
    stealthRelayer = await smock.fake(StealthRelayerArtifact);
  });

  beforeEach(async () => {
    stealthSafeGuard = await stealthSafeGuardFactory.deploy(manageable.address, stealthRelayer.address);
  });

  it('should be connected to Manageable', async () => {
    expect(await stealthSafeGuard.manager()).to.be.equal(manageable.address);
  });

  it('should be connected to OnlyStealthRelayer', async () => {
    expect(await stealthSafeGuard.stealthRelayer()).to.be.equal(stealthRelayer.address);
  });

  it('should set deployer as governor', async () => {
    expect(await stealthSafeGuard.governor()).to.be.equal(governor.address);
  });

  describe('Adding and Removing Executors', () => {
    it('should add and remove executors', async () => {
      const randomOne = wallet.generateRandomAddress();
      await stealthSafeGuard.addExecutor(randomOne);

      const randomTwo = wallet.generateRandomAddress();
      await stealthSafeGuard.addExecutor(randomTwo);

      expect(await stealthSafeGuard.executors()).to.be.deep.equal([randomOne, randomTwo]);

      await stealthSafeGuard.removeExecutor(randomOne);
      expect(await stealthSafeGuard.executors()).to.be.deep.equal([randomTwo]);

      await stealthSafeGuard.removeExecutor(randomTwo);
      expect(await stealthSafeGuard.executors()).to.be.deep.equal([]);
    });

    it('should fail to add zero address as an executor', async () => {
      await expect(stealthSafeGuard.addExecutors([ZERO_ADDRESS])).to.be.revertedWith('ZeroAddress()');
      await expect(stealthSafeGuard.addExecutor(ZERO_ADDRESS)).to.be.revertedWith('ZeroAddress()');
    });

    it('should fail to add an executor that exists', async () => {
      const randomAddress = wallet.generateRandomAddress();
      await stealthSafeGuard.addExecutor(randomAddress);

      await expect(stealthSafeGuard.addExecutor(randomAddress)).to.be.revertedWith('InvalidExecutor()');
      await expect(stealthSafeGuard.addExecutors([randomAddress])).to.be.revertedWith('InvalidExecutor()');
    });

    it('should fail to remove zero address from executors', async () => {
      await expect(stealthSafeGuard.removeExecutor(ZERO_ADDRESS)).to.be.revertedWith('ZeroAddress()');
    });

    it('should fail to remove a non-executor address from executors', async () => {
      await expect(stealthSafeGuard.removeExecutor(wallet.generateRandomAddress())).to.be.revertedWith('InvalidExecutor()');
    });
  });

  describe('Governance Setters', async () => {
    it('should set overrideGuardChecks', async () => {
      expect(await stealthSafeGuard.overrideGuardChecks()).to.be.equal(false);

      await stealthSafeGuard.setOverrideGuardChecks(true);
      expect(await stealthSafeGuard.overrideGuardChecks()).to.be.equal(true);
    });

    it('should set stealthRelayerCheck', async () => {
      expect(await stealthSafeGuard.stealthRelayerCheck()).to.be.equal(false);

      await stealthSafeGuard.setStealthRelayerCheck(true);
      expect(await stealthSafeGuard.stealthRelayerCheck()).to.be.equal(true);
    });
  });

  describe('Manageable Setters', async () => {
    it('should set pending manager and allow pending manager accept manager role', async () => {
      const newManager = await wallet.generateRandomWithBalance();

      await stealthSafeGuard.setPendingManager(newManager.address);
      expect(await stealthSafeGuard.pendingManager()).to.be.equal(newManager.address);

      await stealthSafeGuard.connect(newManager).acceptManager();
      expect(await stealthSafeGuard.manager()).to.be.equal(newManager.address);
    });
  });

  describe('Stealth Relayer Setters', () => {
    it('should set the stealth relayer', async () => {
      const newStealthRelayer = await smock.fake(StealthRelayerArtifact);

      await expect(stealthSafeGuard.setStealthRelayer(newStealthRelayer.address))
        .to.emit(stealthSafeGuard, 'StealthRelayerSet')
        .withArgs(newStealthRelayer.address);

      expect(await stealthSafeGuard.stealthRelayer()).to.be.equal(newStealthRelayer.address);
    });
  });

  describe('Access Control', () => {
    it('should deny non-governors to access these methods', async () => {
      await expect(
        stealthSafeGuard.connect(await wallet.generateRandomWithBalance()).setPendingManager(wallet.generateRandomAddress())
      ).to.be.revertedWith('governable/only-governor');
    });

    it('should deny non-governors or non-managers to access these methods', async () => {
      await expect(
        stealthSafeGuard.connect(await wallet.generateRandomWithBalance()).addExecutors([wallet.generateRandomAddress()])
      ).to.be.revertedWith('NotAuthorized()');

      await expect(
        stealthSafeGuard.connect(await wallet.generateRandomWithBalance()).addExecutor(wallet.generateRandomAddress())
      ).to.be.revertedWith('NotAuthorized()');

      await expect(
        stealthSafeGuard.connect(await wallet.generateRandomWithBalance()).setOverrideGuardChecks(wallet.generateRandomAddress())
      ).to.be.revertedWith('NotAuthorized()');

      await expect(
        stealthSafeGuard.connect(await wallet.generateRandomWithBalance()).setStealthRelayerCheck(wallet.generateRandomAddress())
      ).to.be.revertedWith('NotAuthorized()');

      await expect(
        stealthSafeGuard.connect(await wallet.generateRandomWithBalance()).setStealthRelayer(wallet.generateRandomAddress())
      ).to.be.revertedWith('NotAuthorized()');
    });
  });

  describe('Helper Functions', () => {
    const checkTransaction = (msgSender: string) => {
      const placeholderInputs = [
        ZERO_ADDRESS /*to*/,
        0 /*value*/,
        ethers.constants.HashZero /*data*/,
        0 /*operation*/,
        0 /*safeTxGas*/,
        0 /*baseGas*/,
        0 /*gasPrice*/,
        ZERO_ADDRESS /*gasToken*/,
        ZERO_ADDRESS /*refundReceiver*/,
        ethers.constants.HashZero /*signatures*/,
      ];

      return stealthSafeGuard.checkTransaction(...placeholderInputs, msgSender);
    };

    it('should validate tx if overrideGuardChecks is set to true', async () => {
      await stealthSafeGuard.setOverrideGuardChecks(true);
      await expect(checkTransaction(wallet.generateRandomAddress())).not.to.be.reverted;
    });

    it('should validate tx if the sender is an executor', async () => {
      const executor = wallet.generateRandomAddress();
      await stealthSafeGuard.addExecutor(executor);
      await expect(checkTransaction(executor)).not.to.be.reverted;
    });

    it('should validate tx if the sender is the stealth relayer and the caller is an executor', async () => {
      await stealthSafeGuard.setStealthRelayerCheck(true);
      const caller = wallet.generateRandomAddress();
      stealthRelayer.caller.returns(caller);
      await stealthSafeGuard.addExecutor(caller);

      await expect(checkTransaction(stealthRelayer.address)).not.to.be.reverted;
    });

    it('should invalidate tx if the sender is not the stealth relayer or the stealthRelayer.caller is not an executor', async () => {
      await stealthSafeGuard.setStealthRelayerCheck(true);
      // revert because the msgSender is not the stealth relayer
      await expect(checkTransaction(wallet.generateRandomAddress())).to.be.revertedWith('NotStealthRelayer()');
      // revert because the stealthRelayer.caller is not an executor
      await expect(checkTransaction(stealthRelayer.address)).to.be.revertedWith('NotStealthRelayer()');
    });

    it('should invalidate tx if the sender is not an executor', async () => {
      await expect(checkTransaction(wallet.generateRandomAddress())).to.be.revertedWith('NotExecutor()');
    });
  });
});
