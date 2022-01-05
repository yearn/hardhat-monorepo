import moment from 'moment';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { Contract, ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployMockContract, MockContract } from '@ethereum-waffle/mock-contract';
import { MockProvider } from '@ethereum-waffle/provider';
import { BigNumber, BigNumberish, utils, Wallet } from 'ethers';
import { ethers } from 'hardhat';
import { given, then, when } from '../utils/bdd';
import { constants, wallet } from '../utils';
import { expect } from 'chai';

import StealthVault from '../../artifacts/contracts/StealthVault.sol/StealthVault.json';
import { expectNoEventWithName } from '../utils/event-utils';

describe('StealthTx', () => {
  let governor: SignerWithAddress;
  let forceETHFactory: ContractFactory;
  let stealthTxFactory: ContractFactory;
  let stealthTx: Contract;
  let stealthVaultFactory: ContractFactory;
  let stealthVault: Contract;

  before('Setup accounts and contracts', async () => {
    [governor] = await ethers.getSigners();
    stealthVaultFactory = await ethers.getContractFactory('contracts/mock/StealthVault.sol:StealthVaultMock');
    stealthTxFactory = await ethers.getContractFactory('contracts/mock/StealthTx.sol:StealthTxMock');
    forceETHFactory = await ethers.getContractFactory('contracts/mock/ForceETH.sol:ForceETH');
  });

  beforeEach(async () => {
    stealthVault = await stealthVaultFactory.deploy();
    stealthTx = await stealthTxFactory.deploy(stealthVault.address);
  });

  describe('setStealthVault', () => {
    when('stealth vault is zero address', () => {
      let setStealthVaultTx: Promise<TransactionResponse>;
      given(() => {
        setStealthVaultTx = stealthTx.setStealthVault(constants.ZERO_ADDRESS);
      });
      then('tx is reverted with reason', async () => {
        await expect(setStealthVaultTx).to.be.revertedWith('ST: zero address');
      });
    });
    when('stealth vault does not comply with interface', () => {
      let setStealthVaultTx: Promise<TransactionResponse>;
      given(async () => {
        setStealthVaultTx = stealthTx.setStealthVault(await wallet.generateRandomAddress());
      });
      then('tx is reverted with reason', async () => {
        await expect(setStealthVaultTx).to.be.revertedWith('function call to a non-contract account');
      });
    });
    when('stealth vault does comply with interface', () => {
      let setStealthVaultTx: TransactionResponse;
      let newStealthVault: Contract;
      given(async () => {
        newStealthVault = await stealthVaultFactory.deploy();
        setStealthVaultTx = await stealthTx.setStealthVault(newStealthVault.address);
      });
      then('sets stealth vault', async () => {
        expect(await stealthTx.stealthVault()).to.be.equal(newStealthVault.address);
      });
      then('emits event', async () => {
        await expect(setStealthVaultTx).to.emit(stealthTx, 'StealthVaultSet').withArgs(newStealthVault.address);
      });
    });
  });

  describe('setPenalty', () => {
    when('penalty is being set to zero', () => {
      let setPenaltyTx: Promise<TransactionResponse>;
      given(async () => {
        setPenaltyTx = stealthTx.setPenalty(constants.ZERO);
      });
      then('tx is reverted with reason', async () => {
        await expect(setPenaltyTx).to.be.revertedWith('ST: zero penalty');
      });
    });
    when('penalty being set is valid', () => {
      let setPenaltyTx: TransactionResponse;
      const newPenalty = utils.parseEther('0.123');
      given(async () => {
        setPenaltyTx = await stealthTx.setPenalty(newPenalty);
      });
      then('sets new penalty', async () => {
        expect(await stealthTx.penalty()).to.be.equal(newPenalty);
      });
      then('emits event', async () => {
        await expect(setPenaltyTx).to.emit(stealthTx, 'PenaltySet').withArgs(newPenalty);
      });
    });
  });

  const deployStealthVaultMock = async (): Promise<MockContract> => {
    const stealthVaultMock = await deployMockContract(governor, StealthVault.abi);
    await stealthVaultMock.mock.isStealthVault.returns(true);
    await stealthTx.setStealthVault(stealthVaultMock.address);
    return stealthVaultMock;
  };

  describe('validateStealthTx - Modifier', () => {
    let stealthVaultMock: MockContract;
    const hash = utils.formatBytes32String('some-hash');
    given(async () => {
      stealthVaultMock = await deployStealthVaultMock();
    });
    when('validate stealth tx returns false', () => {
      let validateStealthTxModifier: TransactionResponse;
      given(async () => {
        await stealthVaultMock.mock.validateHash.returns(false);
        validateStealthTxModifier = await stealthTx.validateStealthTxModifier(hash);
      });
      then('stops execution', async () => {
        await expectNoEventWithName(validateStealthTxModifier, 'Event');
      });
    });
    when('validate stealth tx returns true', () => {
      let validateStealthTxModifier: TransactionResponse;
      given(async () => {
        await stealthVaultMock.mock.validateHash.returns(true);
        validateStealthTxModifier = await stealthTx.validateStealthTxModifier(hash);
      });
      then('executes', async () => {
        await expect(validateStealthTxModifier).to.emit(stealthTx, 'Event');
      });
    });
  });

  const behavesLikeValidateStealthTx = ({
    stealthVaultMock,
    funcAndSignature,
    args,
  }: {
    stealthVaultMock: () => MockContract;
    funcAndSignature: string;
    args: () => Promise<any[]>;
  }) => {
    let response: boolean;
    when('stealth vault returns false when validating tx', () => {
      given(async () => {
        await stealthVaultMock().mock.validateHash.returns(false);
        response = await stealthTx.callStatic[funcAndSignature](...(await args()));
      });
      then('returns false', () => {
        expect(response).to.be.false;
      });
    });
    when('stealth vault returns true when validating tx', () => {
      given(async () => {
        await stealthVaultMock().mock.validateHash.returns(true);
        response = await stealthTx.callStatic[funcAndSignature](...(await args()));
      });
      then('returns true', () => {
        expect(response).to.be.true;
      });
    });
  };

  describe('validateStealthTx - Function', () => {
    let stealthVaultMock: MockContract;
    const hash = utils.formatBytes32String('some-hash');
    given(async () => {
      stealthVaultMock = await deployStealthVaultMock();
    });
    behavesLikeValidateStealthTx({
      stealthVaultMock: () => stealthVaultMock,
      funcAndSignature: 'validateStealthTxFunction(bytes32)',
      args: async () => [hash],
    });
  });

  describe('validateStealthTxAndBlock - Modifier', () => {
    let stealthVaultMock: MockContract;
    const hash = utils.formatBytes32String('some-hash');
    given(async () => {
      stealthVaultMock = await deployStealthVaultMock();
    });
    when('validating stealth tx and block with wrong block number', () => {
      let validateStealthTxAndBlockModifierTx: Promise<TransactionResponse>;
      given(async () => {
        const currentBlockNumber = await ethers.provider.getBlockNumber();
        validateStealthTxAndBlockModifierTx = stealthTx.validateStealthTxAndBlockModifier(hash, currentBlockNumber + 10);
      });
      then('tx is reverted with reason', async () => {
        await expect(validateStealthTxAndBlockModifierTx).to.be.revertedWith('ST: wrong block');
      });
    });
    when('validate stealth tx and block returns false', () => {
      let validateStealthTxAndBlockModifierTx: TransactionResponse;
      given(async () => {
        await stealthVaultMock.mock.validateHash.returns(false);
        const currentBlockNumber = await ethers.provider.getBlockNumber();
        validateStealthTxAndBlockModifierTx = await stealthTx.validateStealthTxAndBlockModifier(hash, currentBlockNumber + 1);
      });
      then('stops execution', async () => {
        await expectNoEventWithName(validateStealthTxAndBlockModifierTx, 'Event');
      });
    });
    when('validate stealth tx and block returns true', () => {
      let validateStealthTxAndBlockModifierTx: TransactionResponse;
      given(async () => {
        await stealthVaultMock.mock.validateHash.returns(true);
        const currentBlockNumber = await ethers.provider.getBlockNumber();
        validateStealthTxAndBlockModifierTx = await stealthTx.validateStealthTxAndBlockModifier(hash, currentBlockNumber + 1);
      });
      then('executes', async () => {
        await expect(validateStealthTxAndBlockModifierTx).to.emit(stealthTx, 'Event');
      });
    });
  });

  describe('validateStealthTxAndBlock - Function', () => {
    let stealthVaultMock: MockContract;
    const hash = utils.formatBytes32String('some-hash');
    given(async () => {
      stealthVaultMock = await deployStealthVaultMock();
    });
    when('block is not current block number', () => {
      let validateStealthTxAndBlockFunctionTx: Promise<TransactionResponse>;
      given(async () => {
        const currentBlockNumber = await ethers.provider.getBlockNumber();
        validateStealthTxAndBlockFunctionTx = stealthTx.validateStealthTxAndBlockFunction(hash, currentBlockNumber + 10);
      });
      then('tx is reverted with reason', async () => {
        await expect(validateStealthTxAndBlockFunctionTx).to.be.revertedWith('ST: wrong block');
      });
    });
    when('block is current block number', () => {
      behavesLikeValidateStealthTx({
        stealthVaultMock: () => stealthVaultMock,
        funcAndSignature: 'validateStealthTxAndBlockFunction(bytes32,uint256)',
        args: async () => [hash, await ethers.provider.getBlockNumber()],
      });
    });
  });
});
