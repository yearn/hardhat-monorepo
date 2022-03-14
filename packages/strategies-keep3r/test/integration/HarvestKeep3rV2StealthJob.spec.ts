import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { e18, ZERO_ADDRESS } from '../../utils/web3-utils';
import config from '../../contracts.json';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import * as contracts from '../../utils/contracts';
import * as yOracleContracts from '@lbertenasco/y-oracle/dist/utils/contracts';
import { wallet } from '@test-utils';

const mechanicsContracts = config.contracts.mainnet.mechanics;

const lowerCaseArray = (array: string[]) => array.map((address: string) => address.toLowerCase());

describe('HarvestV2Keep3rStealthJob', () => {
  let owner: SignerWithAddress;

  before('Setup accounts and contracts', async () => {
    [owner] = await ethers.getSigners();
  });

  it('Should deploy on mainnet fork', async function () {
    const multisig = await wallet.impersonate(config.accounts.mainnet.publicKey);
    const deployer = await wallet.impersonate(config.accounts.mainnet.deployer);
    const keeper = await wallet.impersonate(config.accounts.mainnet.keeper);
    const keep3rGovernance = await wallet.impersonate(config.accounts.mainnet.keep3rGovernance);
    const whale = await wallet.impersonate(config.accounts.mainnet.whale);

    (await ethers.getContractFactory('ForceETH')).deploy(keep3rGovernance._address, {
      value: e18.mul(100),
    });
    (await ethers.getContractFactory('ForceETH')).deploy(keeper._address, {
      value: e18.mul(100),
    });

    const v2Keeper = await ethers.getContractAt('V2Keeper', config.contracts.mainnet.proxyJobs.v2Keeper, deployer);

    const HarvestV2Keep3rStealthJob = await ethers.getContractFactory('HarvestV2Keep3rStealthJob');

    const harvestV2Keep3rStealthJob = (
      await HarvestV2Keep3rStealthJob.deploy(
        mechanicsContracts.registry, // address _mechanicsRegistry,
        contracts.stealthRelayer.mainnet, // address _stealthRelayer
        yOracleContracts.yUnsafeOracleV1.mainnet, // address _yOracle
        config.contracts.mainnet.keep3r.address, // address _keep3r,
        ZERO_ADDRESS, // address _bond,
        e18.mul(50), // 50 KP3R required // uint256 _minBond,
        0, // uint256 _earned,
        0, // uint256 _age,
        true, // bool _onlyEOA,
        v2Keeper.address, // address _v2Keeper
        6 * 60 * 60 // uint256 _workCooldown // 6 hours
      )
    ).connect(owner);

    // Add as valid job
    await v2Keeper.addJob(harvestV2Keep3rStealthJob.address);

    // Add to keep3r
    const keep3r = await ethers.getContractAt('IKeep3rV1', config.contracts.mainnet.keep3r.address, keep3rGovernance);
    await keep3r.addJob(harvestV2Keep3rStealthJob.address);
    await keep3r.addKPRCredit(harvestV2Keep3rStealthJob.address, e18.mul(100));

    // Add strategies to job
    const strategies = [
      {
        name: 'test',
        address: '0xF2E9e8eae24deA1a5d40F3a105677AF1797A47D3',
        requiredAmount: 0,
        costToken: ZERO_ADDRESS,
        costPair: ZERO_ADDRESS,
      },
    ];

    // set reward multiplier
    await harvestV2Keep3rStealthJob.setRewardMultiplier(950);

    for (const strategy of strategies) {
      await harvestV2Keep3rStealthJob.addStrategy(
        strategy.address, // address _strategy,
        e18.mul(strategy.requiredAmount), // uint256 _requiredAmount,
        strategy.costToken, // address _costToken,
        strategy.costPair // address _costPair
      );
    }

    const jobStrategies = await harvestV2Keep3rStealthJob.strategies();
    expect(lowerCaseArray(jobStrategies)).to.be.deep.eq(lowerCaseArray(strategies.map((s) => s.address)));

    let workable = await harvestV2Keep3rStealthJob.callStatic.workable(strategies[0].address);
    console.log({ workable });

    // Stealth contracts and setup
    const stealthVault = await ethers.getContractAt('IStealthVault', contracts.stealthVault.mainnet as string, deployer);
    const stealthRelayer = await ethers.getContractAt('IStealthRelayer', contracts.stealthRelayer.mainnet as string, deployer);
    // Set job in stealth relayer
    await stealthRelayer.addJob(harvestV2Keep3rStealthJob.address);

    // keeper stealthVault setup
    const penalty = await stealthRelayer.callStatic.penalty();
    await stealthVault.connect(keeper).bond({ value: penalty });
    await stealthVault.connect(keeper).enableStealthContract(stealthRelayer.address);

    // populates work transaction
    const rawTx = await harvestV2Keep3rStealthJob.populateTransaction.work(strategies[0].address);
    const callData = rawTx.data;

    const stealthHash = ethers.utils.solidityKeccak256(['string'], ['random-secret-hash']);
    let blockNumber = await ethers.provider.getBlockNumber();

    const pendingBlock = await ethers.provider.send('eth_getBlockByNumber', ['latest', false]);
    const blockGasLimit = BigNumber.from(pendingBlock.gasLimit);

    let workTx = await stealthRelayer.connect(keeper).execute(
      harvestV2Keep3rStealthJob.address, // address _job,
      callData, // bytes memory _callData,
      stealthHash, // bytes32 _stealthHash,
      blockNumber + 2, // uint256 _blockNumber
      { gasLimit: blockGasLimit.sub(15_000) }
    );

    let workTxData = await workTx.wait();
    console.log('gasUsed:', workTxData.cumulativeGasUsed.toNumber());

    expect(await harvestV2Keep3rStealthJob.callStatic.workable(strategies[0].address)).to.be.false;
  });
});
