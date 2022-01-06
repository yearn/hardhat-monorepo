import { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chai from 'chai';
import { constants, Contract, ContractFactory, ContractInterface, Signer, Wallet } from 'ethers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { Provider } from '@ethersproject/providers';
import { getStatic } from 'ethers/lib/utils';
import { wallet } from '.';
import { when, given, then } from './bdd';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

chai.use(chaiAsPromised);

type Impersonator = Signer | Provider | string;

export const checkTxRevertedWithMessage = async ({
  tx,
  message,
}: {
  tx: Promise<TransactionResponse>;
  message: RegExp | string;
}): Promise<void> => {
  await expect(tx).to.be.reverted;
  if (message instanceof RegExp) {
    await expect(tx).eventually.rejected.have.property('message').match(message);
  } else {
    await expect(tx).to.be.revertedWith(message);
  }
};

export const checkTxRevertedWithZeroAddress = async (tx: Promise<TransactionResponse>): Promise<void> => {
  await checkTxRevertedWithMessage({
    tx,
    message: /ZeroAddress/,
  });
};

export const deployShouldRevertWithZeroAddress = async ({ contract, args }: { contract: ContractFactory; args: any[] }): Promise<void> => {
  const deployContractTx = await contract.getDeployTransaction(...args);
  const tx = contract.signer.sendTransaction(deployContractTx);
  await checkTxRevertedWithZeroAddress(tx);
};

export const deployShouldRevertWithMessage = async ({
  contract,
  args,
  message,
}: {
  contract: ContractFactory;
  args: any[];
  message: string;
}): Promise<void> => {
  const deployContractTx = await contract.getDeployTransaction(...args);
  const tx = contract.signer.sendTransaction(deployContractTx);
  await checkTxRevertedWithMessage({ tx, message });
};

export const txShouldRevertWithZeroAddress = async ({
  contract,
  func,
  args,
}: {
  contract: Contract;
  func: string;
  args: any[];
  tx?: Promise<TransactionResponse>;
}): Promise<void> => {
  const tx = contract[func](...args);
  await checkTxRevertedWithZeroAddress(tx);
};

export const txShouldRevertWithMessage = async ({
  contract,
  func,
  args,
  message,
}: {
  contract: Contract;
  func: string;
  args: any[];
  message: string;
}): Promise<void> => {
  const tx = contract[func](...args);
  await checkTxRevertedWithMessage({ tx, message });
};

export const checkTxEmittedEvents = async ({
  contract,
  tx,
  events,
}: {
  contract: Contract;
  tx: TransactionResponse;
  events: { name: string; args: any[] }[];
}): Promise<void> => {
  for (let i = 0; i < events.length; i++) {
    await expect(tx)
      .to.emit(contract, events[i].name)
      .withArgs(...events[i].args);
  }
};

export const deployShouldSetVariablesAndEmitEvents = async ({
  contract,
  args,
  settersGettersVariablesAndEvents,
}: {
  contract: ContractFactory;
  args: any[];
  settersGettersVariablesAndEvents: {
    getterFunc: string;
    variable: any;
    eventEmitted: string;
  }[];
}): Promise<void> => {
  const deployContractTx = await contract.getDeployTransaction(...args);
  const tx = await contract.signer.sendTransaction(deployContractTx);
  const address = getStatic<(tx: TransactionResponse) => string>(contract.constructor, 'getContractAddress')(tx);
  const deployedContract = getStatic<(address: string, contractInterface: ContractInterface, signer?: Signer) => Contract>(
    contract.constructor,
    'getContract'
  )(address, contract.interface, contract.signer);
  await txShouldHaveSetVariablesAndEmitEvents({
    contract: deployedContract,
    tx,
    settersGettersVariablesAndEvents,
  });
};

export const txShouldHaveSetVariablesAndEmitEvents = async ({
  contract,
  tx,
  settersGettersVariablesAndEvents,
}: {
  contract: Contract;
  tx: TransactionResponse;
  settersGettersVariablesAndEvents: {
    getterFunc: string;
    variable: any;
    eventEmitted: string;
  }[];
}): Promise<void> => {
  for (let i = 0; i < settersGettersVariablesAndEvents.length; i++) {
    await checkTxEmittedEvents({
      contract,
      tx,
      events: [
        {
          name: settersGettersVariablesAndEvents[i].eventEmitted,
          args: [settersGettersVariablesAndEvents[i].variable],
        },
      ],
    });
    expect(await contract[settersGettersVariablesAndEvents[i].getterFunc]()).to.eq(settersGettersVariablesAndEvents[i].variable);
  }
};

export const txShouldSetVariableAndEmitEvent = async ({
  contract,
  setterFunc,
  getterFunc,
  variable,
  eventEmitted,
}: {
  contract: Contract;
  setterFunc: string;
  getterFunc: string;
  variable: any;
  eventEmitted: string;
}): Promise<void> => {
  expect(await contract[getterFunc]()).to.not.eq(variable);
  const tx = contract[setterFunc](variable);
  await txShouldHaveSetVariablesAndEmitEvents({
    contract,
    tx,
    settersGettersVariablesAndEvents: [
      {
        getterFunc,
        variable,
        eventEmitted,
      },
    ],
  });
};

export const fnShouldOnlyBeCallableByGovernance = (
  delayedContract: () => Contract,
  fnName: string,
  governance: Impersonator,
  args: unknown[] | (() => unknown[])
): void => {
  it('should be callable by governance', () => {
    return expect(callFunction(governance)).not.to.be.revertedWith('OnlyGovernance()');
  });

  it('should not be callable by any address', async () => {
    return expect(callFunction(await wallet.generateRandom())).to.be.revertedWith('OnlyGovernance()');
  });

  function callFunction(impersonator: Impersonator) {
    const argsArray: unknown[] = typeof args === 'function' ? args() : args;
    const fn = delayedContract().connect(impersonator)[fnName] as (...args: unknown[]) => unknown;
    return fn(...argsArray, { gasPrice: 0 });
  }
};

export const shouldBeExecutableOnlyByTradeFactory = ({
  contract,
  funcAndSignature,
  params,
  tradeFactory,
}: {
  contract: () => Contract;
  funcAndSignature: string;
  params?: any[];
  tradeFactory: () => SignerWithAddress | Wallet;
}) => {
  params = params ?? [];
  when('not called from trade factory', () => {
    let onlyTradeFactoryAllowedTx: Promise<TransactionResponse>;
    given(async () => {
      const notGovernor = await wallet.generateRandom();
      onlyTradeFactoryAllowedTx = contract()
        .connect(notGovernor)
        [funcAndSignature](...params!);
    });
    then('tx is reverted with reason', async () => {
      await expect(onlyTradeFactoryAllowedTx).to.be.revertedWith('NotAuthorized()');
    });
  });
  when('called from factory', () => {
    let onlyTradeFactoryAllowedTx: Promise<TransactionResponse>;
    given(async () => {
      onlyTradeFactoryAllowedTx = contract()
        .connect(tradeFactory())
        [funcAndSignature](...params!);
    });
    then('tx is not reverted or not reverted with reason only trade factory', async () => {
      await expect(onlyTradeFactoryAllowedTx).to.not.be.revertedWith('NotAuthorized()');
    });
  });
};

export const shouldBeCheckPreAssetSwap = ({ contract, func, withData }: { contract: () => Contract; func: string; withData: boolean }) => {
  when('receiver is zero address', () => {
    let tx: Promise<TransactionResponse>;
    given(async () => {
      const args = [constants.AddressZero, wallet.generateRandomAddress(), wallet.generateRandomAddress(), constants.One, constants.One];
      if (withData) args.push('0x');
      tx = contract()[func](...args);
    });
    then('tx is reverted with reason', async () => {
      await expect(tx).to.be.revertedWith('ZeroAddress()');
    });
  });
  when('token in is zero address', () => {
    let tx: Promise<TransactionResponse>;
    given(async () => {
      const args = [wallet.generateRandomAddress(), constants.AddressZero, wallet.generateRandomAddress(), constants.One, constants.One];
      if (withData) args.push('0x');
      tx = contract()[func](...args);
    });
    then('tx is reverted with reason', async () => {
      await expect(tx).to.be.revertedWith('ZeroAddress()');
    });
  });
  when('token out is zero address', () => {
    let tx: Promise<TransactionResponse>;
    given(async () => {
      const args = [wallet.generateRandomAddress(), wallet.generateRandomAddress(), constants.AddressZero, constants.One, constants.One];
      if (withData) args.push('0x');
      tx = contract()[func](...args);
    });
    then('tx is reverted with reason', async () => {
      await expect(tx).to.be.revertedWith('ZeroAddress()');
    });
  });
  when('amount is zero', () => {
    let tx: Promise<TransactionResponse>;
    given(async () => {
      const args = [
        wallet.generateRandomAddress(),
        wallet.generateRandomAddress(),
        wallet.generateRandomAddress(),
        constants.Zero,
        constants.One,
      ];
      if (withData) args.push('0x');
      tx = contract()[func](...args);
    });
    then('tx is reverted with reason', async () => {
      await expect(tx).to.be.revertedWith('ZeroAmount()');
    });
  });
  when('max slippage is zero', () => {
    let tx: Promise<TransactionResponse>;
    given(async () => {
      const args = [
        wallet.generateRandomAddress(),
        wallet.generateRandomAddress(),
        wallet.generateRandomAddress(),
        constants.One,
        constants.Zero,
      ];
      if (withData) args.push('0x');
      tx = contract()[func](...args);
    });
    then('tx is reverted with reason', async () => {
      await expect(tx).to.be.revertedWith('ZeroSlippage()');
    });
  });
};
