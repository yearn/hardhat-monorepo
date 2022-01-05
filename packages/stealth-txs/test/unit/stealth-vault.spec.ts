import moment from 'moment';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { Contract, ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, BigNumberish, utils, Wallet } from 'ethers';
import { ethers } from 'hardhat';
import { given, then, when } from '../utils/bdd';
import { constants, wallet } from '../utils';
import { expect } from 'chai';

describe('StealthVault', () => {
  let governor: SignerWithAddress;
  let forceETHFactory: ContractFactory;
  let jobMockFactory: ContractFactory;
  let stealthVaultFactory: ContractFactory;
  let stealthVault: Contract;
  let blockGasLimit: BigNumber;

  before('Setup accounts and contracts', async () => {
    [governor] = await ethers.getSigners();
    stealthVaultFactory = await ethers.getContractFactory('contracts/mock/StealthVault.sol:StealthVaultMock');
    jobMockFactory = await ethers.getContractFactory('contracts/mock/StealthVault.sol:StealthContractMock');
    forceETHFactory = await ethers.getContractFactory('contracts/mock/ForceETH.sol:ForceETH');
    const pendingBlock = await ethers.provider.send('eth_getBlockByNumber', ['latest', false]);
    blockGasLimit = BigNumber.from(pendingBlock.gasLimit);
  });

  beforeEach('StealthVault', async () => {
    stealthVault = await stealthVaultFactory.deploy();
    await stealthVault.setGasBuffer(1_000_000);
  });

  it('reverts when sending eth', async () => {
    await expect(governor.sendTransaction({ to: stealthVault.address, value: utils.parseEther('1') })).to.be.revertedWith(
      "function selector was not recognized and there's no fallback nor receive function"
    );
  });

  describe('isStealthVault', async () => {
    then('returns true', async () => {
      expect(await stealthVault.isStealthVault()).to.be.true;
    });
  });

  describe('callers', () => {
    when('there are no callers', () => {
      then('returns empty array', async () => {
        expect(await stealthVault.callers()).to.be.empty;
      });
    });
    when('there are callers', () => {
      let callers: string[];
      given(async () => {
        callers = [await wallet.generateRandomAddress(), await wallet.generateRandomAddress(), await wallet.generateRandomAddress()];
        await stealthVault.addCaller(callers[0]);
        await stealthVault.addCaller(callers[1]);
        await stealthVault.addCaller(callers[2]);
      });
      then('returns array with correct values', async () => {
        expect(await stealthVault.callers()).to.eql(callers);
      });
    });
  });
  describe('callerContracts', () => {
    when('caller doesnt have enabled jobs', () => {
      then('returns empty array', async () => {
        expect(await stealthVault.callerContracts(await wallet.generateRandomAddress())).to.be.empty;
      });
    });
    when('caller does have enabled jobs', () => {
      let caller: string;
      let callerEnabledJobs: string[];
      given(async () => {
        caller = await wallet.generateRandomAddress();
        callerEnabledJobs = [await wallet.generateRandomAddress(), await wallet.generateRandomAddress(), await wallet.generateRandomAddress()];
        await stealthVault.addCallerStealthContract(caller, callerEnabledJobs[0]);
        await stealthVault.addCallerStealthContract(caller, callerEnabledJobs[1]);
        await stealthVault.addCallerStealthContract(caller, callerEnabledJobs[2]);
      });
      then('returns array with correct values', async () => {
        expect(await stealthVault.callerContracts(caller)).to.eql(callerEnabledJobs);
      });
    });
  });
  describe('caller', () => {
    when('caller is not on callers set', () => {
      then('returns false', async () => {
        expect(await stealthVault.caller(await wallet.generateRandomAddress())).to.be.false;
      });
    });
    when('caller is on callers set', () => {
      let caller: string;
      given(async () => {
        caller = await wallet.generateRandomAddress();
        await stealthVault.addCaller(caller);
      });
      then('returns true', async () => {
        expect(await stealthVault.caller(caller)).to.be.true;
      });
    });
  });
  describe('callerStealthContract', () => {
    when('caller does not have job enabled', () => {
      then('returns false', async () => {
        expect(await stealthVault.callerStealthContract(await wallet.generateRandomAddress(), await wallet.generateRandomAddress())).to.be.false;
      });
    });
    when('caller has job enabled', () => {
      let caller: string;
      let job: string;
      given(async () => {
        caller = await wallet.generateRandomAddress();
        job = await wallet.generateRandomAddress();
        await stealthVault.addCallerStealthContract(caller, job);
      });
      then('returns true', async () => {
        expect(await stealthVault.callerStealthContract(caller, job)).to.be.true;
      });
    });
  });

  describe('setGasBuffer', () => {
    const newGasBuffer = 40_000;
    let setGasBufferTx: Promise<TransactionResponse>;

    when('newGasBuffer is low', () => {
      given(async () => {
        await stealthVault.setGasBuffer(newGasBuffer);
      });
      then('updates gasBuffer', async () => {
        expect(await stealthVault.gasBuffer()).to.equal(newGasBuffer);
      });
    });
    when('newGasBuffer is too high', () => {
      given(async () => {
        setGasBufferTx = stealthVault.setGasBuffer(blockGasLimit.mul(63).div(64).add(1));
      });
      then('reverts', async () => {
        await expect(setGasBufferTx).to.be.revertedWith('SV: gasBuffer too high');
      });
    });
    when('newGasBuffer is quite not too high', () => {
      given(async () => {
        await stealthVault.setGasBuffer(blockGasLimit.mul(63).div(64).sub(1));
      });
      then('updates gasBuffer', async () => {
        expect(await stealthVault.gasBuffer()).to.equal(blockGasLimit.mul(63).div(64).sub(1));
      });
    });
  });

  describe('transferGovernorBond', () => {
    let caller: string;
    let initialGovernorBond = utils.parseEther('102');
    let initialCallerBond = utils.parseEther('2.24335');
    const transfered = utils.parseEther('5.6949');
    given(async () => {
      caller = await wallet.generateRandomAddress();
      await stealthVault.setBonded(governor.address, initialGovernorBond);
      await stealthVault.setBonded(caller, initialCallerBond);
      await stealthVault.transferGovernorBond(caller, transfered);
    });
    // only governor
    then('reduces bond of governor', async () => {
      expect(await stealthVault.bonded(governor.address)).to.equal(initialGovernorBond.sub(transfered));
    });
    then('increases bond of caller', async () => {
      expect(await stealthVault.bonded(caller)).to.equal(initialCallerBond.add(transfered));
    });
  });

  describe('transferBondToGovernor', () => {
    let caller: string;
    let initialGovernorBond = utils.parseEther('100');
    let initialCallerBond = utils.parseEther('20');
    const transfered = initialCallerBond.div(2);
    given(async () => {
      caller = await wallet.generateRandomAddress();
      await stealthVault.setBonded(governor.address, initialGovernorBond);
      await stealthVault.setBonded(caller, initialCallerBond);
      await stealthVault.transferBondToGovernor(caller, transfered);
    });
    // only governor
    then('reduces bond of governor', async () => {
      expect(await stealthVault.bonded(governor.address)).to.equal(initialGovernorBond.add(transfered));
    });
    then('increases bond of caller', async () => {
      expect(await stealthVault.bonded(caller)).to.equal(initialCallerBond.sub(transfered));
    });
  });

  describe('bond', () => {
    when('bonding zero eth', () => {
      let bondTx: Promise<TransactionResponse>;
      given(async () => {
        bondTx = stealthVault.bond({ value: 0 });
      });
      then('tx is reverted with reason', async () => {
        await expect(bondTx).to.be.revertedWith('SV: bond more than zero');
      });
    });
    when('first time bonding', () => {
      let bondTx: TransactionResponse;
      let initialUserBalance: BigNumber;
      let initialContractBalance: BigNumber;
      let usedGas: BigNumber;
      const bonding = utils.parseEther('1');
      given(async () => {
        initialUserBalance = await ethers.provider.getBalance(governor.address);
        initialContractBalance = await ethers.provider.getBalance(stealthVault.address);
        bondTx = await stealthVault.bond({ value: bonding });
        const tx = await bondTx.wait();
        usedGas = tx.cumulativeGasUsed.mul(tx.effectiveGasPrice);
      });
      then('eth is taken away from user', async () => {
        expect(await ethers.provider.getBalance(governor.address)).to.be.equal(initialUserBalance.sub(bonding).sub(usedGas));
      });
      then('eth is deposited in contract', async () => {
        expect(await ethers.provider.getBalance(stealthVault.address)).to.be.equal(initialContractBalance.add(bonding));
      });
      then('amount is added to bonded amount of caller', async () => {
        expect(await stealthVault.bonded(governor.address)).to.be.equal(bonding);
      });
      then('amount is added to total bonded', async () => {
        expect(await stealthVault.totalBonded()).to.be.equal(bonding);
      });
      then('emits event', async () => {
        await expect(bondTx).to.emit(stealthVault, 'Bonded').withArgs(governor.address, bonding, bonding);
      });
    });
    when('not first time bonding', async () => {
      let bondTx: TransactionResponse;
      let initialUserBalance: BigNumber;
      let initialContractBalance: BigNumber;
      let usedGas: BigNumber;
      const initialUserBonded = utils.parseEther('0.353');
      const bonding = utils.parseEther('1');
      given(async () => {
        await stealthVault.setBonded(governor.address, initialUserBonded);
        initialUserBalance = await ethers.provider.getBalance(governor.address);
        initialContractBalance = await ethers.provider.getBalance(stealthVault.address);
        bondTx = await stealthVault.bond({ value: bonding });
        const tx = await bondTx.wait();
        usedGas = tx.cumulativeGasUsed.mul(tx.effectiveGasPrice);
      });
      then('eth is taken away from user', async () => {
        expect(await ethers.provider.getBalance(governor.address)).to.be.equal(initialUserBalance.sub(bonding).sub(usedGas));
      });
      then('eth is deposited in contract', async () => {
        expect(await ethers.provider.getBalance(stealthVault.address)).to.be.equal(initialContractBalance.add(bonding));
      });
      then('amount is added to bonded amount of caller', async () => {
        expect(await stealthVault.bonded(governor.address)).to.be.equal(initialUserBonded.add(bonding));
      });
      then('amount is added to total bonded', async () => {
        expect(await stealthVault.totalBonded()).to.be.equal(bonding);
      });
      then('emits event', async () => {
        await expect(bondTx).to.emit(stealthVault, 'Bonded').withArgs(governor.address, bonding, initialUserBonded.add(bonding));
      });
    });
  });

  const behavesLikeUnbond = ({
    funcAndSignature,
    args,
    bonded,
    unbond,
  }: {
    funcAndSignature: string;
    args?: any[];
    bonded: number;
    unbond: number;
  }) => {
    let unbondTx: TransactionResponse;
    let initialUserBalance: BigNumber;
    let initialContractBalance: BigNumber;
    let usedGas: BigNumber;
    given(async () => {
      args = args ?? [];
      await stealthVault.setTotalBonded(bonded);
      await stealthVault.setBonded(governor.address, bonded);
      await stealthVault.setCanUnbondAt(governor.address, moment().subtract(1, 'second').unix());
      await forceETHFactory.deploy(stealthVault.address, { value: bonded });
      initialContractBalance = await ethers.provider.getBalance(stealthVault.address);
      initialUserBalance = await ethers.provider.getBalance(governor.address);
      unbondTx = await stealthVault[funcAndSignature](...args!);
      const tx = await unbondTx.wait();
      usedGas = tx.cumulativeGasUsed.mul(tx.effectiveGasPrice);
    });
    then('amount bonded by user gets reduced', async () => {
      expect(await stealthVault.bonded(governor.address)).to.be.equal(bonded - unbond);
    });
    then('total bonded by users gets reduced', async () => {
      expect(await stealthVault.totalBonded()).to.be.equal(bonded - unbond);
    });
    then('eth is taken from the contract', async () => {
      expect(await ethers.provider.getBalance(stealthVault.address)).to.be.equal(initialContractBalance.sub(unbond));
    });
    then('eth is sent to the user', async () => {
      expect(await ethers.provider.getBalance(governor.address)).to.be.equal(initialUserBalance.add(unbond).sub(usedGas));
    });
    then('emits event', async () => {
      await expect(unbondTx)
        .to.emit(stealthVault, 'Unbonded')
        .withArgs(governor.address, unbond, bonded - unbond);
    });
  };

  describe('unbond', () => {
    when('unbonding zero', () => {
      let unbondTx: Promise<TransactionResponse>;
      given(async () => {
        unbondTx = stealthVault.unbond(0);
      });
      then('tx is reverted with reason', async () => {
        await expect(unbondTx).to.be.revertedWith('SV: more than zero');
      });
    });
    when('unbonding more than bonded', () => {
      let unbondTx: Promise<TransactionResponse>;
      given(async () => {
        await stealthVault.setBonded(governor.address, 1);
        unbondTx = stealthVault.unbond(2);
      });
      then('tx is reverted with reason', async () => {
        await expect(unbondTx).to.be.revertedWith('SV: amount too high');
      });
    });
    when('unbond while not unbonding', () => {
      let unbondTx: Promise<TransactionResponse>;
      given(async () => {
        await stealthVault.setBonded(governor.address, 1);
        unbondTx = stealthVault.unbond(1);
      });
      then('tx is reverted with reason', async () => {
        await expect(unbondTx).to.be.revertedWith('SV: not unbondind');
      });
    });
    when('unbond while unbonding in cooldown', () => {
      let unbondTx: Promise<TransactionResponse>;
      given(async () => {
        await stealthVault.setBonded(governor.address, 1);
        await stealthVault.startUnbond();
        unbondTx = stealthVault.unbond(1);
      });
      then('tx is reverted with reason', async () => {
        await expect(unbondTx).to.be.revertedWith('SV: unbond in cooldown');
      });
    });
    when('unbond while unbonding was cancelled', () => {
      let unbondTx: Promise<TransactionResponse>;
      given(async () => {
        await stealthVault.setBonded(governor.address, 1);
        await stealthVault.startUnbond();
        await stealthVault.cancelUnbond();
        unbondTx = stealthVault.unbond(1);
      });
      then('tx is reverted with reason', async () => {
        await expect(unbondTx).to.be.revertedWith('SV: not unbondind');
      });
    });
    when('unbonded less than 4 days ago', () => {
      let unbondTx: Promise<TransactionResponse>;
      given(async () => {
        await stealthVault.setBonded(governor.address, 2);
        await stealthVault.setCanUnbondAt(governor.address, moment().add(4, 'days').unix());
        unbondTx = stealthVault.unbond(1);
      });
      then('tx is reverted with reason', async () => {
        await expect(unbondTx).to.be.revertedWith('SV: unbond in cooldown');
      });
    });
    when('unbonding exactly the bonded amount', () => {
      behavesLikeUnbond({
        funcAndSignature: 'unbond(uint256)',
        args: [1000],
        bonded: 1000,
        unbond: 1000,
      });
    });
    when('unbonding less than bonded', () => {
      behavesLikeUnbond({
        funcAndSignature: 'unbond(uint256)',
        args: [932],
        bonded: 1000,
        unbond: 932,
      });
    });
  });

  describe('unbondAll', () => {
    when('it has zero bonded', () => {
      let unbondAllTx: Promise<TransactionResponse>;
      given(async () => {
        unbondAllTx = stealthVault.unbondAll();
      });
      then('tx is reverted with reason', async () => {
        await expect(unbondAllTx).to.be.revertedWith('SV: more than zero');
      });
    });
    when('it has more than zero bonded', () => {
      behavesLikeUnbond({
        funcAndSignature: 'unbondAll()',
        args: [],
        bonded: 1000,
        unbond: 1000,
      });
    });
  });

  const behavesLikePenaltyApplied = async ({
    caller,
    initialBondedByCaller,
    penalty,
    reporterOfHash,
  }: {
    caller: () => string;
    initialBondedByCaller: BigNumber;
    penalty: BigNumber;
    reporterOfHash: string;
  }) => {
    then('bonded by caller gets reduced by the amount', async () => {
      expect(await stealthVault.bonded(caller())).to.be.equal(initialBondedByCaller.sub(penalty));
    });
    then('hash reporter gets their bonded increased by reward amount', async () => {
      expect(await stealthVault.bonded(reporterOfHash)).to.be.equal(penalty.div(10));
    });
    then('governor gets bonded increased by the amount subtracting reward amount', async () => {
      expect(await stealthVault.bonded(governor.address)).to.be.equal(penalty.sub(penalty.div(10)));
    });
  };

  describe('_penalize', () => {
    let caller = '0x1Ff482D42D8727258A1686102Fa4ba925C46Bc42';
    let hashReporter = '0x52bc44d5378309ee2abf1539bf71de1b7d7be3b5';
    const initialBonded = utils.parseEther('10');
    given(async () => {
      await stealthVault.setTotalBonded(initialBonded);
      await stealthVault.setBonded(caller, initialBonded);
      await forceETHFactory.deploy(stealthVault.address, { value: initialBonded });
    });
    when('not taking all bond from caller', () => {
      const penalty = utils.parseEther('0.5');
      given(async () => {
        await stealthVault.penalize(caller, penalty, hashReporter);
      });
      behavesLikePenaltyApplied({
        caller: () => caller,
        initialBondedByCaller: initialBonded,
        penalty,
        reporterOfHash: hashReporter,
      });
    });
    when('when taking all bond from caller', () => {
      const penalty = initialBonded;
      given(async () => {
        await stealthVault.penalize(caller, penalty, hashReporter);
      });
      behavesLikePenaltyApplied({
        caller: () => caller,
        initialBondedByCaller: initialBonded,
        penalty,
        reporterOfHash: hashReporter,
      });
    });
  });

  describe('validateHash', () => {
    let caller: Wallet;
    given(async () => {
      caller = await wallet.generateRandom();
    });
    when('not called from an external owned account', () => {
      let validateTx: Promise<TransactionResponse>;
      given(async () => {
        validateTx = stealthVault.connect(caller).validateHash(await wallet.generateRandomAddress(), utils.formatBytes32String('some-hash'), 0);
      });
      then('tx is reverted with reason', async () => {
        await expect(validateTx).to.be.revertedWith('SV: not eoa');
      });
    });
    when('caller doesnt have that job whitelisted', () => {
      let validateTx: Promise<TransactionResponse>;
      given(() => {
        validateTx = stealthVault.connect(caller).validateHash(caller.address, utils.formatBytes32String('some-hash'), 0);
      });
      then('tx is reverted with reason', async () => {
        await expect(validateTx).to.be.revertedWith('SV: contract not enabled');
      });
    });
    when('caller does not have enough bonded for penalty', () => {
      let validateTx: Promise<TransactionResponse>;
      let jobMock: Contract;
      given(async () => {
        jobMock = await jobMockFactory.deploy(stealthVault.address);
        await stealthVault.addCallerStealthContract(caller.address, jobMock.address);
        validateTx = jobMock.connect(caller).validateHash(utils.formatBytes32String('some-hash'), 1);
      });
      then('tx is reverted with reason', async () => {
        await expect(validateTx).to.be.revertedWith('SV: not enough bonded');
      });
    });
    when('caller is unbonding', () => {
      let validateTx: Promise<TransactionResponse>;
      let jobMock: Contract;
      const penalty = 1;
      given(async () => {
        jobMock = await jobMockFactory.deploy(stealthVault.address);
        await stealthVault.setBonded(caller.address, penalty);
        await stealthVault.addCallerStealthContract(caller.address, jobMock.address);
        await stealthVault.connect(caller).startUnbond();
        validateTx = jobMock.connect(caller).validateHash(utils.formatBytes32String('some-hash'), penalty);
      });
      then('tx is reverted with reason', async () => {
        await expect(validateTx).to.be.revertedWith('SV: unbonding');
      });
    });
    when('caller was unbonding but cancelled', () => {
      let validHash: boolean;
      let jobMock: Contract;
      const penalty = 1;
      given(async () => {
        jobMock = await jobMockFactory.deploy(stealthVault.address);
        await stealthVault.setBonded(caller.address, penalty);
        await stealthVault.addCallerStealthContract(caller.address, jobMock.address);
        await stealthVault.connect(caller).startUnbond();
        await stealthVault.connect(caller).cancelUnbond();
        validHash = await jobMock.connect(caller).callStatic.validateHash(utils.formatBytes32String('some-hash'), penalty);
      });
      then('returns true', () => {
        expect(validHash).to.be.true;
      });
    });
    when('hash was not reported', () => {
      let validHash: boolean;
      let validateTx: TransactionResponse;
      let jobMock: Contract;
      const hash = utils.formatBytes32String('some-hash');
      const penalty = 1;
      given(async () => {
        jobMock = await jobMockFactory.deploy(stealthVault.address);
        await stealthVault.setBonded(caller.address, penalty);
        await stealthVault.addCallerStealthContract(caller.address, jobMock.address);
        validHash = await jobMock.connect(caller).callStatic.validateHash(hash, penalty);
        validateTx = await jobMock.connect(caller).validateHash(hash, penalty);
      });
      then('returns true', () => {
        expect(validHash).to.be.true;
      });
      then('emits event', async () => {
        await expect(validateTx).to.emit(stealthVault, 'ValidatedHash').withArgs(hash, caller.address, penalty);
      });
    });
    when('hash was reported', () => {
      let validHash: boolean;
      let validateTx: TransactionResponse;
      let jobMock: Contract;
      let hashReporter = '0x52bc44d5378309EE2abF1539BF71dE1b7d7bE3b5';
      const hash = utils.formatBytes32String('some-hash');
      const penalty = 1;
      given(async () => {
        jobMock = await jobMockFactory.deploy(stealthVault.address);
        await stealthVault.setBonded(caller.address, penalty);
        await stealthVault.addCallerStealthContract(caller.address, jobMock.address);
        await stealthVault.setHashReportedBy(hash, hashReporter);
        validHash = await jobMock.connect(caller).callStatic.validateHash(hash, penalty);
        validateTx = await jobMock.connect(caller).validateHash(hash, penalty);
      });
      behavesLikePenaltyApplied({
        caller: () => caller.address,
        initialBondedByCaller: BigNumber.from(`${penalty}`),
        penalty: BigNumber.from(`${penalty}`),
        reporterOfHash: hashReporter,
      });
      then('returns false', () => {
        expect(validHash).to.be.false;
      });
      then('emits event', async () => {
        await expect(validateTx).to.emit(stealthVault, 'PenaltyApplied').withArgs(hash, caller.address, penalty, hashReporter);
      });
    });
  });

  describe('reportHash', () => {
    when('hash was already reported', () => {
      let reportHashTx: Promise<TransactionResponse>;
      const hash = utils.formatBytes32String('some-hash');
      given(async () => {
        await stealthVault.setHashReportedBy(hash, constants.NOT_ZERO_ADDRESS);
        reportHashTx = stealthVault.reportHash(hash);
      });
      then('tx is reverted with reason', async () => {
        await expect(reportHashTx).to.be.revertedWith('SV: hash already reported');
      });
    });
    when('hash is valid', () => {
      let reportHashTx: TransactionResponse;
      const hash = utils.formatBytes32String('some-hash');
      given(async () => {
        reportHashTx = await stealthVault.reportHash(hash);
      });
      then('hash gets marked as reported by message sender', async () => {
        expect(await stealthVault.hashReportedBy(hash)).to.be.equal(governor.address);
      });
      then('emits event', async () => {
        await expect(reportHashTx).to.emit(stealthVault, 'ReportedHash').withArgs(hash, governor.address);
      });
    });
  });

  describe('enableStealthContract', () => {
    when('enabling already enabled job', () => {
      let stealthJob: string;
      let enableStealthContractTx: Promise<TransactionResponse>;
      given(async () => {
        stealthJob = await wallet.generateRandomAddress();
        await stealthVault.addCallerContract(governor.address, stealthJob);
        enableStealthContractTx = stealthVault.enableStealthContract(stealthJob);
      });
      then('tx is reverted with reason', async () => {
        await expect(enableStealthContractTx).to.be.revertedWith('SV: contract already added');
      });
    });
    when('enabling a valid job for the first time', () => {
      let stealthJob: string;
      let enableStealthContractTx: TransactionResponse;
      given(async () => {
        stealthJob = await wallet.generateRandomAddress();
        enableStealthContractTx = await stealthVault.enableStealthContract(stealthJob);
      });
      then('job gets added to caller enabled jobs', async () => {
        expect(await stealthVault.callerContracts(governor.address)).to.have.members([stealthJob]);
      });
      then('caller gets added to callers set', async () => {
        expect(await stealthVault.callers()).to.have.members([governor.address]);
      });
    });
    when('enabling a valid job', () => {
      let stealthJobAdded: string;
      let stealthJob: string;
      let enableStealthContractTx: TransactionResponse;
      given(async () => {
        stealthJob = await wallet.generateRandomAddress();
        stealthJobAdded = await wallet.generateRandomAddress();
        await stealthVault.addCallerContract(governor.address, stealthJobAdded);
        enableStealthContractTx = await stealthVault.enableStealthContract(stealthJob);
      });
      then('job gets added to caller enabled jobs', async () => {
        expect(await stealthVault.callerContracts(governor.address)).to.have.members([stealthJob, stealthJobAdded]);
      });
    });
  });
  describe('enableStealthContracts', () => {
    when('enabling already enabled job', () => {
      let stealthJob: string;
      let enableStealthContractsTx: Promise<TransactionResponse>;
      given(async () => {
        stealthJob = await wallet.generateRandomAddress();
        await stealthVault.addCallerContract(governor.address, stealthJob);
        enableStealthContractsTx = stealthVault.enableStealthContracts([stealthJob]);
      });
      then('tx is reverted with reason', async () => {
        await expect(enableStealthContractsTx).to.be.revertedWith('SV: contract already added');
      });
    });
    when('enabling a valid jobs for the first time', () => {
      let stealthJob1: string;
      let stealthJob2: string;
      let enableStealthContractsTx: TransactionResponse;
      given(async () => {
        stealthJob1 = await wallet.generateRandomAddress();
        stealthJob2 = await wallet.generateRandomAddress();
        enableStealthContractsTx = await stealthVault.enableStealthContracts([stealthJob1, stealthJob2]);
      });
      then('jobs gets added to caller enabled jobs', async () => {
        expect(await stealthVault.callerContracts(governor.address)).to.have.members([stealthJob1, stealthJob2]);
      });
      then('caller gets added to callers set', async () => {
        expect(await stealthVault.callers()).to.have.members([governor.address]);
      });
    });
    when('enabling a valid jobs', () => {
      let stealthJobAdded: string;
      let stealthJob1: string;
      let stealthJob2: string;
      let enableStealthContractsTx: TransactionResponse;
      given(async () => {
        stealthJob1 = await wallet.generateRandomAddress();
        stealthJob2 = await wallet.generateRandomAddress();
        stealthJobAdded = await wallet.generateRandomAddress();
        await stealthVault.addCallerContract(governor.address, stealthJobAdded);
        enableStealthContractsTx = await stealthVault.enableStealthContracts([stealthJob1, stealthJob2]);
      });
      then('job gets added to caller enabled jobs', async () => {
        expect(await stealthVault.callerContracts(governor.address)).to.have.members([stealthJob1, stealthJob2, stealthJobAdded]);
      });
    });
  });
  describe('disableStealthContract', () => {
    when('disabling a job that is not enabled', () => {
      let disableStealthContractTx: Promise<TransactionResponse>;
      given(async () => {
        disableStealthContractTx = stealthVault.disableStealthContract(await wallet.generateRandomAddress());
      });
      then('tx is reverted with reason', async () => {
        await expect(disableStealthContractTx).to.be.revertedWith('SV: contract not found');
      });
    });
    when('disabling one of many jobs', () => {
      let stealthJobAdded1: string;
      let stealthJobAdded2: string;
      let disableStealthContractTx: TransactionResponse;
      given(async () => {
        stealthJobAdded1 = await wallet.generateRandomAddress();
        stealthJobAdded2 = await wallet.generateRandomAddress();
        await stealthVault.addCallerContract(governor.address, stealthJobAdded1);
        await stealthVault.addCallerContract(governor.address, stealthJobAdded2);
        disableStealthContractTx = await stealthVault.disableStealthContract(stealthJobAdded1);
      });
      then('job gets removed from enabled jobs', async () => {
        expect(await stealthVault.callerContracts(governor.address)).to.have.members([stealthJobAdded2]);
      });
    });
    when('disabling last enabled job', () => {
      let stealthJobAdded: string;
      let disableStealthContractTx: TransactionResponse;
      given(async () => {
        stealthJobAdded = await wallet.generateRandomAddress();
        await stealthVault.addCaller(governor.address);
        await stealthVault.addCallerContract(governor.address, stealthJobAdded);
        disableStealthContractTx = await stealthVault.disableStealthContract(stealthJobAdded);
      });
      then('job gets removed from enabled jobs', async () => {
        expect(await stealthVault.callerContracts(governor.address)).to.be.empty;
      });
      then('caller gets removed from callers set', async () => {
        expect(await stealthVault.callers()).to.be.empty;
      });
    });
  });
  describe('disableStealthContracts', () => {
    when('disabling jobs that are not enabled', () => {
      let disableStealthContractsTx: Promise<TransactionResponse>;
      given(async () => {
        disableStealthContractsTx = stealthVault.disableStealthContracts([await wallet.generateRandomAddress()]);
      });
      then('tx is reverted with reason', async () => {
        await expect(disableStealthContractsTx).to.be.revertedWith('SV: contract not found');
      });
    });
    when('disabling one of many jobs', () => {
      let stealthJobAdded1: string;
      let stealthJobAdded2: string;
      let stealthJobAdded3: string;
      let disableStealthContractTx: TransactionResponse;
      given(async () => {
        stealthJobAdded1 = await wallet.generateRandomAddress();
        stealthJobAdded2 = await wallet.generateRandomAddress();
        stealthJobAdded3 = await wallet.generateRandomAddress();
        await stealthVault.addCallerContract(governor.address, stealthJobAdded1);
        await stealthVault.addCallerContract(governor.address, stealthJobAdded2);
        await stealthVault.addCallerContract(governor.address, stealthJobAdded3);
        disableStealthContractTx = await stealthVault.disableStealthContracts([stealthJobAdded1, stealthJobAdded3]);
      });
      then('jobs gets removed from enabled jobs', async () => {
        expect(await stealthVault.callerContracts(governor.address)).to.have.members([stealthJobAdded2]);
      });
    });
    when('disabling last enabled jobs', () => {
      let stealthJobAdded1: string;
      let stealthJobAdded2: string;
      let disableStealthContractTx: TransactionResponse;
      given(async () => {
        stealthJobAdded1 = await wallet.generateRandomAddress();
        stealthJobAdded2 = await wallet.generateRandomAddress();
        await stealthVault.addCaller(governor.address);
        await stealthVault.addCallerContract(governor.address, stealthJobAdded1);
        await stealthVault.addCallerContract(governor.address, stealthJobAdded2);
        disableStealthContractTx = await stealthVault.disableStealthContracts([stealthJobAdded1, stealthJobAdded2]);
      });
      then('job gets removed from enabled jobs', async () => {
        expect(await stealthVault.callerContracts(governor.address)).to.be.empty;
      });
      then('caller gets removed from callers set', async () => {
        expect(await stealthVault.callers()).to.be.empty;
      });
    });
  });
});
