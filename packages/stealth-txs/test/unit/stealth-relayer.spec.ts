import { TransactionResponse } from '@ethersproject/abstract-provider';
import { Contract, ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployMockContract, MockContract } from '@ethereum-waffle/mock-contract';
import { utils } from 'ethers';
import { ethers } from 'hardhat';
import { given, then, when } from '../utils/bdd';
import { wallet } from '../utils';
import { expect } from 'chai';

import StealthVault from '../../artifacts/contracts/StealthVault.sol/StealthVault.json';
import { expectNoEventWithName } from '../utils/event-utils';

describe('StealthRelayer', () => {
  let governor: SignerWithAddress;
  let stealthRelayerFactory: ContractFactory;
  let stealthRelayer: Contract;
  let stealthVaultFactory: ContractFactory;
  let stealthVault: Contract;
  let jobMockFactory: ContractFactory;

  before('Setup accounts and contracts', async () => {
    [governor] = await ethers.getSigners();
    stealthVaultFactory = await ethers.getContractFactory('contracts/mock/StealthVault.sol:StealthVaultMock');
    stealthRelayerFactory = await ethers.getContractFactory('contracts/mock/StealthRelayer.sol:StealthRelayerMock');
    jobMockFactory = await ethers.getContractFactory('contracts/mock/StealthRelayer.sol:JobMock');
  });

  beforeEach(async () => {
    stealthVault = await stealthVaultFactory.deploy();
    stealthRelayer = await stealthRelayerFactory.deploy(governor.address, stealthVault.address);
  });

  const deployStealthVaultMock = async (): Promise<MockContract> => {
    const stealthVaultMock = await deployMockContract(governor, StealthVault.abi);
    await stealthVaultMock.mock.isStealthVault.returns(true);
    await stealthRelayer.setStealthVault(stealthVaultMock.address);
    return stealthVaultMock;
  };

  describe('execute', () => {
    shouldBehaveLikeOnlyValidJob({
      contract: () => stealthRelayer,
      funcAndSignature: 'execute(address,bytes,bytes32,uint256)',
      args: ['_job', utils.formatBytes32String(''), utils.formatBytes32String(''), 0],
    });
    when('executing a valid job', () => {
      let stealthVaultMock: MockContract;
      let jobMock: Contract;
      let currentBlockNumber: number;
      let callData: string;
      let workData: string;
      given(async () => {
        stealthVaultMock = await deployStealthVaultMock();
        jobMock = await jobMockFactory.deploy();
        await stealthRelayer.addJob(jobMock.address);
        workData = utils.formatBytes32String('workData');
        const rawTx = await jobMock.populateTransaction.work(workData);
        callData = rawTx.data!;
      });
      when('validate stealth tx and block returns false', () => {
        let executeTx: TransactionResponse;
        given(async () => {
          await stealthVaultMock.mock.validateHash.returns(false);
          currentBlockNumber = await ethers.provider.getBlockNumber();
          executeTx = await stealthRelayer.execute(jobMock.address, callData, utils.formatBytes32String(''), currentBlockNumber + 1);
        });
        then('stops execution', async () => {
          await expectNoEventWithName(executeTx, 'Event');
        });
      });
      when('all parameters are valid and function call reverts', () => {
        let executeTx: Promise<TransactionResponse>;
        given(async () => {
          await stealthVaultMock.mock.validateHash.returns(true);
          await jobMock.setShouldRevert(true);
          currentBlockNumber = await ethers.provider.getBlockNumber();
          executeTx = stealthRelayer.execute(jobMock.address, callData, utils.formatBytes32String(''), currentBlockNumber + 1);
        });
        then('tx is reverted with reason', async () => {
          await expect(executeTx).to.be.revertedWith('!w');
        });
      });
      when('all parameters are valid and function call doesnt revert', () => {
        let executeTx: TransactionResponse;
        let returnString: string;
        given(async () => {
          await stealthVaultMock.mock.validateHash.returns(true);
          currentBlockNumber = await ethers.provider.getBlockNumber();
          returnString = await stealthRelayer.callStatic.execute(jobMock.address, callData, utils.formatBytes32String(''), currentBlockNumber);
          executeTx = await stealthRelayer.execute(jobMock.address, callData, utils.formatBytes32String(''), currentBlockNumber + 1);
        });
        then('executes call', async () => {
          await expect(executeTx).to.emit(jobMock, 'Event').withArgs(workData);
        });
        then('returns function call return', async () => {
          await expect(returnString).to.not.be.empty;
        });
      });
    });
  });

  describe('executeWithoutBlockProtection', () => {
    shouldBehaveLikeOnlyValidJob({
      contract: () => stealthRelayer,
      funcAndSignature: 'executeWithoutBlockProtection(address,bytes,bytes32)',
      args: ['_job', utils.formatBytes32String(''), utils.formatBytes32String('')],
    });
    when('calling a valid job', () => {
      let stealthVaultMock: MockContract;
      let jobMock: Contract;
      let callData: string;
      let workData: string;
      given(async () => {
        stealthVaultMock = await deployStealthVaultMock();
        jobMock = await jobMockFactory.deploy();
        await stealthRelayer.addJob(jobMock.address);
        workData = utils.formatBytes32String('workData');
        const rawTx = await jobMock.populateTransaction.work(workData);
        callData = rawTx.data!;
      });
      when('validate stealth tx and block returns false', () => {
        let executeTx: TransactionResponse;
        given(async () => {
          await stealthVaultMock.mock.validateHash.returns(false);
          executeTx = await stealthRelayer.executeWithoutBlockProtection(jobMock.address, callData, utils.formatBytes32String(''));
        });
        then('stops execution', async () => {
          await expectNoEventWithName(executeTx, 'Event');
        });
      });
      when('block protection is forced', () => {
        let executeTx: Promise<TransactionResponse>;
        given(async () => {
          await stealthVaultMock.mock.validateHash.returns(true);
          await stealthRelayer.setForceBlockProtection(true);
          executeTx = stealthRelayer.executeWithoutBlockProtection(jobMock.address, callData, utils.formatBytes32String(''));
        });
        then('tx is reverted with reason', async () => {
          await expect(executeTx).to.be.revertedWith('SR: block protection required');
        });
      });
      when('all parameters are valid and function call reverts', () => {
        let executeTx: Promise<TransactionResponse>;
        given(async () => {
          await stealthVaultMock.mock.validateHash.returns(true);
          await jobMock.setShouldRevert(true);
          executeTx = stealthRelayer.executeWithoutBlockProtection(jobMock.address, callData, utils.formatBytes32String(''));
        });
        then('tx is reverted with reason', async () => {
          await expect(executeTx).to.be.revertedWith('!w');
        });
      });
      when('all parameters are valid and function call doesnt revert', () => {
        let executeTx: TransactionResponse;
        let returnString: string;
        given(async () => {
          await stealthVaultMock.mock.validateHash.returns(true);
          returnString = await stealthRelayer.callStatic.executeWithoutBlockProtection(jobMock.address, callData, utils.formatBytes32String(''));
          executeTx = await stealthRelayer.executeWithoutBlockProtection(jobMock.address, callData, utils.formatBytes32String(''));
        });
        then('executes call', async () => {
          await expect(executeTx).to.emit(jobMock, 'Event').withArgs(workData);
        });
        then('returns function call return', async () => {
          await expect(returnString).to.not.be.empty;
        });
      });
    });
  });

  async function shouldBehaveLikeOnlyValidJob({
    contract,
    funcAndSignature,
    args,
  }: {
    contract: () => Contract;
    funcAndSignature: string;
    args?: any[];
  }) {
    args = args ?? [];
    let validJob: string;
    before(async () => {
      validJob = await wallet.generateRandomAddress();
      args = args!.map((arg) => (arg === '_job' ? validJob : arg));
    });
    when('executing with an invalid job', () => {
      let invalidTx: Promise<TransactionResponse>;
      given(() => {
        invalidTx = contract()[funcAndSignature](...args!);
      });
      then('tx is reverted with reason', async () => {
        await expect(invalidTx).to.be.revertedWith('SR: invalid job');
      });
    });
    when('executing with an valid job', () => {
      let validTx: Promise<TransactionResponse>;
      given(async () => {
        await stealthRelayer.addJob(validJob);
        validTx = contract()[funcAndSignature](...args!);
      });
      then('tx is executed or not reverted with invalid job reason', async () => {
        await expect(validTx).to.not.be.revertedWith('SR: invalid job');
      });
    });
  }

  describe('onlyValidJob', () => {
    shouldBehaveLikeOnlyValidJob({
      contract: () => stealthRelayer,
      funcAndSignature: 'onlyValidJobModifier(address)',
      args: ['_job'],
    });
  });

  describe('jobs', () => {
    when('there are no added jobs', () => {
      then('returns empty array');
    });
    when('there are jobs', () => {
      then('returns correct values');
    });
  });

  describe('addJob', () => {
    // only governor
    when('job was already added', () => {
      then('tx is reverted with reason');
    });
    when('job was not already added', () => {
      then('adds job to set');
    });
  });

  describe('addJobs', () => {
    // only governor
    when('a job was already added', () => {
      then('tx is reverted with reason');
    });
    when('jobs were not already added', () => {
      then('adds jobs to set');
    });
  });

  describe('removeJob', () => {
    // only governor
    when('job was not added', () => {
      then('tx is reverted with reason');
    });
    when('job was added', () => {
      then('removes job from set');
    });
  });

  describe('removeJobs', () => {
    // only governor
    when('one of the job was not added', () => {
      then('tx is reverted with reason');
    });
    when('jobs were added', () => {
      then('removes jobs from set');
    });
  });

  describe('setPenalty', () => {
    // only governor
  });

  describe('setStealthVault', () => {
    // only governor
  });
});
