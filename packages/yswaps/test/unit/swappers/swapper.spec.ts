import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { behaviours, contracts, evm, wallet } from '@test-utils';
import { contract, given, then, when } from '@test-utils/bdd';
import { constants } from 'ethers';
import { SwapperMock, SwapperMock__factory } from '@typechained';

contract('Swapper', () => {
  let governor: SignerWithAddress;
  let tradeFactory: SignerWithAddress;
  let swapperFactory: SwapperMock__factory;
  let swapper: SwapperMock;
  let snapshotId: string;

  before(async () => {
    [governor, tradeFactory] = await ethers.getSigners();
    swapperFactory = await ethers.getContractFactory<SwapperMock__factory>('contracts/mock/swappers/Swapper.sol:SwapperMock');
    swapper = await swapperFactory.deploy(governor.address, tradeFactory.address);
    snapshotId = await evm.snapshot.take();
  });

  beforeEach(async () => {
    await evm.snapshot.revert(snapshotId);
  });

  describe('constructor', () => {
    // when('governor is zero address', () => {
    //   let deploymentTx: Promise<TransactionResponse>;
    //   given(async () => {
    //     const deployment = await contracts.deploy(swapperFactory, [constants.AddressZero, constants.NOT_ZERO_ADDRESS]);
    //     deploymentTx = deployment.tx.wait();
    //   });
    //   then('tx is reverted with reason', async () => {
    //     await expect(deploymentTx).to.be.reverted;
    //   });
    // });
    when('trade factory is zero address', () => {
      then('tx is reverted with reason', async () => {
        await behaviours.deployShouldRevertWithZeroAddress({
          contract: swapperFactory,
          args: [wallet.generateRandomAddress(), constants.AddressZero],
        });
      });
    });
    when('data is valid', () => {
      let deploymentTx: TransactionResponse;
      let deploymentContract: SwapperMock;
      given(async () => {
        const deployment = await contracts.deploy(swapperFactory, [governor.address, tradeFactory.address]);
        deploymentTx = deployment.tx as TransactionResponse;
        deploymentContract = deployment.contract! as SwapperMock;
      });
      then('governor is set', async () => {
        expect(await deploymentContract.governor()).to.be.equal(governor.address);
      });
      then('trade factory is set', async () => {
        expect(await deploymentContract.TRADE_FACTORY()).to.be.equal(tradeFactory.address);
      });
    });
  });

  describe('onlyTradeFactory', () => {
    behaviours.shouldBeExecutableOnlyByTradeFactory({
      contract: () => swapper,
      funcAndSignature: 'modifierOnlyTradeFactory()',
      params: [],
      tradeFactory: () => tradeFactory,
    });
  });

  // describe('assertPreSwap', () => {
  //   behaviours.shouldBeCheckPreAssetSwap({
  //     contract: () => swapper,
  //     func: 'assertPreSwap',
  //     withData: false,
  //   });
  // });

  // describe('swap', () => {
  //   behaviours.shouldBeExecutableOnlyByTradeFactory({
  //     contract: () => swapper,
  //     funcAndSignature: 'swap(address,address,address,uint256,uint256,bytes)',
  //     params: [constants.AddressZero, constants.AddressZero, constants.AddressZero, constants.Zero, constants.Zero, '0x'],
  //     tradeFactory: () => tradeFactory,
  //   });
  //   behaviours.shouldBeCheckPreAssetSwap({
  //     contract: () => swapper.connect(tradeFactory),
  //     func: 'swap',
  //     withData: true,
  //   });
  //   when('everything is valid', () => {
  //     let tokenIn: IERC20;
  //     let swapTx: TransactionResponse;
  //     let receiver: string;
  //     let tokenOut: string;
  //     const amount = utils.parseEther('10');
  //     const maxSlippage = BigNumber.from('1000');
  //     const data = contracts.encodeParameters(['uint256'], [constants.MaxUint256]);
  //     given(async () => {
  //       receiver = wallet.generateRandomAddress();
  //       tokenOut = wallet.generateRandomAddress();
  //       tokenIn = await erc20.deploy({
  //         initialAccount: tradeFactory.address,
  //         initialAmount: amount,
  //         name: 'Token In',
  //         symbol: 'TI',
  //       });
  //       await tokenIn.connect(tradeFactory).approve(swapper.address, amount);
  //       swapTx = await swapper.connect(tradeFactory).swap(receiver, tokenIn.address, tokenOut, amount, maxSlippage, data);
  //     });
  //     then('can decode data correctly', async () => {
  //       await expect(swapTx).to.emit(swapper, 'DecodedData').withArgs(constants.MaxUint256);
  //     });
  //     then('executes internal swap', async () => {
  //       await expect(swapTx).to.emit(swapper, 'MyInternalExecuteSwap').withArgs(receiver, tokenIn.address, tokenOut, amount, maxSlippage, data);
  //     });
  //     then('emits event with correct information', async () => {
  //       await expect(swapTx).to.emit(swapper, 'Swapped').withArgs(receiver, tokenIn.address, tokenOut, amount, maxSlippage, 1000, data);
  //     });
  //   });
  // });

  describe('sendDust', () => {
    // only governor
  });
});
