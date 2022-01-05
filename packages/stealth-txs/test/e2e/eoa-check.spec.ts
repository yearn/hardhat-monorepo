import { Contract, ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { utils, BigNumber } from 'ethers';

describe('e2e: eoa check', () => {
  let owner: SignerWithAddress, alice: SignerWithAddress, bob: SignerWithAddress;
  let keeper: string;
  let stealthVaultFactory: ContractFactory;
  let stealthVault: Contract;
  let stealthRelayerFactory: ContractFactory;
  let stealthRelayer: Contract;
  let stealthERC20Factory: ContractFactory;
  let stealthERC20: Contract;
  let proxyMockFactory: ContractFactory;
  let proxyMock: Contract;
  const penalty = utils.parseEther('1');
  let blockGasLimit: BigNumber;

  before('Setup accounts and contracts', async () => {
    [owner, alice, bob] = await ethers.getSigners();
    keeper = owner.address;
    stealthVaultFactory = await ethers.getContractFactory('StealthVault');
    stealthRelayerFactory = await ethers.getContractFactory('StealthRelayer');
    stealthERC20Factory = await ethers.getContractFactory('StealthERC20');
    const pendingBlock = await ethers.provider.send('eth_getBlockByNumber', ['latest', false]);
    blockGasLimit = BigNumber.from(pendingBlock.gasLimit);
  });

  beforeEach('EoA checks', async () => {
    stealthVault = await stealthVaultFactory.deploy();
    stealthRelayer = await stealthRelayerFactory.deploy(stealthVault.address);
    stealthERC20 = await stealthERC20Factory.deploy(
      'stealth token', // string memory _name,
      'sToken', // string memory _symbol,
      utils.parseEther('1000000'), // uint256 _mintAmount,
      stealthRelayer.address // address _stealthRelayer
    );

    // set penalty and enables stealth ERC20 to be called from stealthRelayer
    await stealthRelayer.setPenalty(penalty); // (default is 1 ETH)
    await stealthRelayer.addJob(stealthERC20.address);
    await stealthVault.connect(alice).bond({ value: penalty });
    await stealthVault.connect(alice).enableStealthContract(stealthRelayer.address);
    await stealthVault.setEoaAuthCallProtection(true);
  });

  it('receives proper gas', async () => {
    // call stealthERC20 through stealth relayer
    const mintAmount = utils.parseEther('100');
    const rawTx = await stealthERC20.connect(alice).populateTransaction.stealthMint(alice.address, mintAmount);
    const callData = rawTx.data;

    const stealthHash = ethers.utils.solidityKeccak256(['string'], ['random-secret-hash']);
    let blockNumber = await ethers.provider.getBlockNumber();

    await expect(
      stealthRelayer.connect(alice).execute(
        stealthERC20.address, // address _job,
        callData, // bytes memory _callData,
        stealthHash, // bytes32 _stealthHash,
        blockNumber + 1, // uint256 _blockNumber
        { gasLimit: 1_000_000 } // hardhat default block.gasLimit is 12450000
      )
    ).to.be.revertedWith('SV: eoa gas check failed');

    await stealthRelayer.connect(alice).execute(
      stealthERC20.address, // address _job,
      callData, // bytes memory _callData,
      stealthHash, // bytes32 _stealthHash,
      blockNumber + 2, // uint256 _blockNumber
      { gasLimit: blockGasLimit }
    );
  });

  describe('interacting through proxy', () => {
    beforeEach('EoA checks', async () => {
      stealthVaultFactory = await ethers.getContractFactory('StealthVaultEOAMock');
      stealthVault = await stealthVaultFactory.deploy();
      stealthRelayer = await stealthRelayerFactory.deploy(stealthVault.address);
      stealthERC20 = await stealthERC20Factory.deploy(
        'stealth token', // string memory _name,
        'sToken', // string memory _symbol,
        utils.parseEther('1000000'), // uint256 _mintAmount,
        stealthRelayer.address // address _stealthRelayer
      );

      // set penalty and enables stealth ERC20 to be called from stealthRelayer
      await stealthRelayer.setPenalty(penalty); // (default is 1 ETH)
      await stealthRelayer.addJob(stealthERC20.address);
      await stealthVault.connect(alice).bond({ value: penalty });
      await stealthVault.connect(alice).enableStealthContract(stealthRelayer.address);
      await stealthVault.setEoaAuthCallProtection(true);
    });
    it('cannot be called though a proxy', async () => {
      // deploy proxy
      proxyMockFactory = await ethers.getContractFactory('ProxyMock');
      proxyMock = await proxyMockFactory.deploy();

      // call stealthERC20 through stealth relayer though proxy
      const mintAmount = utils.parseEther('100');
      const rawTx = await stealthERC20.connect(alice).populateTransaction.stealthMint(alice.address, mintAmount);
      const callData = rawTx.data;

      const stealthHash = ethers.utils.solidityKeccak256(['string'], ['random-secret-hash']);

      let blockNumber = await ethers.provider.getBlockNumber();
      const rawTx2 = await stealthRelayer.connect(alice).populateTransaction.execute(
        stealthERC20.address, // address _job,
        callData, // bytes memory _callData,
        stealthHash, // bytes32 _stealthHash,
        blockNumber + 1 // uint256 _blockNumber
      );
      const callData2 = rawTx2.data;

      await expect(
        proxyMock.connect(alice).execute(
          stealthRelayer.address, // address _job,
          callData2, // bytes memory _callData,
          { gasLimit: blockGasLimit } // hardhat default block.gasLimit is 12450000
        )
      ).to.be.revertedWith('SV: eoa gas check failed');

      // increase gasBuffer so check eoa does not fail
      await stealthVault.setGasBuffer(2_000_000);

      blockNumber = await ethers.provider.getBlockNumber();
      const rawTx3 = await stealthRelayer.connect(alice).populateTransaction.execute(
        stealthERC20.address, // address _job,
        callData, // bytes memory _callData,
        stealthHash, // bytes32 _stealthHash,
        blockNumber + 1 // uint256 _blockNumber
      );
      const callData3 = rawTx3.data;

      await proxyMock.connect(alice).execute(
        stealthRelayer.address, // address _job,
        callData3, // bytes memory _callData,
        { gasLimit: blockGasLimit } // hardhat default block.gasLimit is 12450000
      );
    });
  });

  it.skip('logs gas ussage', async () => {
    // call stealthERC20 through stealth relayer
    const mintAmount = utils.parseEther('100');
    const rawTx = await stealthERC20.connect(alice).populateTransaction.stealthMint(alice.address, mintAmount);
    const callData = rawTx.data;

    const stealthHash = ethers.utils.solidityKeccak256(['string'], ['random-secret-hash']);
    let blockNumber = await ethers.provider.getBlockNumber();

    // 33_228 is the gas consumed up to this point from StealthRelayer

    /* How to get gas used on stealthRelayer up-to EOA check:
      - get gasused() - gasLimit63 (should give you a negative number)
        - remember to call from stealthRelayer
    */

    // await stealthVault.connect(alice).validateHash(
    //   alice.address, // address _caller,
    //   stealthHash, // bytes32 _hash,
    //   0, // uint256 _penalty
    //   { gasLimit: blockGasLimit }
    // );
    /**
      gasLeft 12427475
      block.gaslimit 12450000
      (block.gaslimit / 64) * 63 12255468
      (block.gaslimit / 64) * 62 bis 12060936
      diff base 22525
      diff 172007
      diff bis 
     */

    await stealthRelayer.connect(alice).execute(
      stealthERC20.address, // address _job,
      callData, // bytes memory _callData,
      stealthHash, // bytes32 _stealthHash,
      blockNumber + 1, // uint256 _blockNumber
      { gasLimit: blockGasLimit }
    );
    /**
      relayer gasLeft: 12423790
      gasLeft 12222240
      block.gaslimit 12450000
      (block.gaslimit / 64) * 63 12255468
      (block.gaslimit / 64) * 62 bis 12060936
      diff base 227760
      diff - 33228
      diff bis 
    */
  });
});
