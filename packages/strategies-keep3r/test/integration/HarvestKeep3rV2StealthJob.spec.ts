import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { e18, ZERO_ADDRESS } from '../../utils/web3-utils';
import config from '../../contracts.json';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import * as contracts from '../../utils/contracts';
import * as yOracleContracts from '@lbertenasco/y-oracle/dist/utils/contracts';
import { evm, wallet } from '@test-utils';
import { getNodeUrl } from '@utils/network';

const mechanicsContracts = config.contracts.mainnet.mechanics;

const lowerCaseArray = (array: string[]) => array.map((address: string) => address.toLowerCase());

describe('HarvestKeep3rV2StealthJob', () => {
  let owner: SignerWithAddress;
  let keeper: any;
  let anotherKeeper:any;
  let keep3rGovernance: any;
  let whale: any;
  let governorV2Keeper: any;
  let governorStrategy: any;

  let testStrategyAddress:string = "0xF2E9e8eae24deA1a5d40F3a105677AF1797A47D3";
  let governorStrategyAddress:string = "0x16388463d60FFE0661Cf7F1f31a7D658aC790ff7";
  let newStealthVault:string = "0xde2fe402A285363283853bEC903d134426DB3Ff7";

  let v2Keeper:any;
  let harvestKeep3rV2StealthJob:any;
  let stealthRelayer:any;
  let stealthVault:any;
  let strategy:any;
  let keep3rV2:any;

  let strategies:any[];

  before('Setup accounts and contracts', async () => {
    [owner] = await ethers.getSigners();

    await evm.reset({
      jsonRpcUrl: getNodeUrl('mainnet'),
      blockNumber: 14385751,
    });

    // wallets
    keeper = await wallet.impersonate(config.accounts.mainnet.keeper);
    anotherKeeper = await wallet.generateRandomWithBalance();
    keep3rGovernance = await wallet.impersonate(config.accounts.mainnet.keep3rGovernance);
    whale = await wallet.impersonate(config.accounts.mainnet.whale);
    governorV2Keeper = await wallet.impersonate(config.accounts.mainnet.governorV2Keeper);
    governorStrategy = await wallet.impersonate(governorStrategyAddress);

    (await ethers.getContractFactory('ForceETH')).deploy(keep3rGovernance._address, {
      value: e18.mul(100),
    });
    (await ethers.getContractFactory('ForceETH')).deploy(keeper._address, {
      value: e18.mul(100),
    });

    v2Keeper = await ethers.getContractAt('V2Keeper', config.contracts.mainnet.proxyJobs.v2Keeper, governorV2Keeper);
    keep3rV2 = await ethers.getContractAt('@yearn/contract-utils/contracts/interfaces/keep3rV2/IKeep3r.sol:IKeep3r', config.contracts.mainnet.keep3rV2.address, keep3rGovernance);

    // Stealth contracts and setup
    stealthVault = await ethers.getContractAt('IStealthVault', newStealthVault, governorV2Keeper);
    stealthRelayer = await ethers.getContractAt('IStealthRelayer', contracts.stealthRelayer.mainnet as string, governorV2Keeper);

    // Fund WETH
    const wethSigner = await wallet.impersonate(config.contracts.mainnet.wethToken.address);
    const weth = await ethers.getContractAt('ERC20Token', config.contracts.mainnet.wethToken.address, wethSigner);

    // keeper stealthVault setup
    const penalty = await stealthRelayer.callStatic.penalty();
    await stealthVault.connect(anotherKeeper).bond({ value: penalty });
    await stealthVault.connect(anotherKeeper).enableStealthContract(stealthRelayer.address);
    
    // Transfer WETH
    await weth.connect(wethSigner).transfer(anotherKeeper.address, e18.mul(10));
    
    // Register keeper (bond WETH)
    await weth.connect(anotherKeeper).approve(keep3rV2.address, e18.mul(10));
    await keep3rV2.connect(anotherKeeper).bond(config.contracts.mainnet.wethToken.address, e18.mul(10));
    await evm.advanceTimeAndBlock(4 * 24 * 60 * 60); // 4 days
    await keep3rV2.connect(anotherKeeper).activate(config.contracts.mainnet.wethToken.address);

    // Register keeper (bond KP3R)
    await keep3rV2.connect(keeper).bond(config.contracts.mainnet.keep3r.address, e18.mul(0));
    await evm.advanceTimeAndBlock(4 * 24 * 60 * 60); // 4 days
    await keep3rV2.connect(keeper).activate(config.contracts.mainnet.keep3r.address);

    // Change undesired config in strategy
    strategy = new ethers.Contract(testStrategyAddress, [
			'function setDoHealthCheck(bool _doHealthCheck) external'
		], governorStrategy);
    await strategy.setDoHealthCheck(false);
  });

  it('Should deploy on mainnet fork', async function () {
    const HarvestKeep3rV2StealthJob = await ethers.getContractFactory('HarvestKeep3rV2StealthJob');

    harvestKeep3rV2StealthJob = (
      await HarvestKeep3rV2StealthJob.deploy(
        mechanicsContracts.registry, // address _mechanicsRegistry,
        contracts.stealthRelayer.mainnet, // address _stealthRelayer
        yOracleContracts.yUnsafeOracleV1.mainnet, // address _yOracle
        config.contracts.mainnet.keep3rV2.address, // address _keep3r,
        ZERO_ADDRESS, // address _bond,
        0, //e18.mul(50), // 50 KP3R required // uint256 _minBond,
        0, // uint256 _earned,
        0, // uint256 _age,
        true, // bool _onlyEOA,
        v2Keeper.address, // address _v2Keeper
        6 * 60 * 60 // uint256 _workCooldown // 6 hours
      )
    ).connect(owner);

    // Add as valid job
    await v2Keeper.addJob(harvestKeep3rV2StealthJob.address);

    // Add to keep3rV2
    await keep3rV2.addJob(harvestKeep3rV2StealthJob.address);
    await keep3rV2.forceLiquidityCreditsToJob(harvestKeep3rV2StealthJob.address, e18.mul(10000));

    // Add strategies to job
    strategies = [
      {
        name: 'test',
        address: testStrategyAddress,
        requiredAmount: 0,
        costToken: ZERO_ADDRESS,
        costPair: ZERO_ADDRESS,
      },
    ];

    // set reward multiplier
    await harvestKeep3rV2StealthJob.setRewardMultiplier(950);

    for (const strategy of strategies) {
      await harvestKeep3rV2StealthJob.addStrategy(
        strategy.address, // address _strategy,
        e18.mul(strategy.requiredAmount), // uint256 _requiredAmount,
        strategy.costToken, // address _costToken,
        strategy.costPair // address _costPair
      );
    }

    const jobStrategies = await harvestKeep3rV2StealthJob.strategies();
    expect(lowerCaseArray(jobStrategies)).to.be.deep.eq(lowerCaseArray(strategies.map((s) => s.address)));

    // Set job in stealth relayer
    await stealthRelayer.addJob(harvestKeep3rV2StealthJob.address);

    // keeper stealthVault setup
    const penalty = await stealthRelayer.callStatic.penalty();
    await stealthVault.connect(keeper).bond({ value: penalty });
    await stealthVault.connect(keeper).enableStealthContract(stealthRelayer.address);
  });

  it('Should work and get paid in bonded KP3R', async function () {
    // populates work transaction
    const rawTx = await harvestKeep3rV2StealthJob.connect(keeper).populateTransaction.work(strategies[0].address);
    const callData = rawTx.data;

    const stealthHash = ethers.utils.solidityKeccak256(['string'], ['random-secret-hash']);
    let blockNumber = await ethers.provider.getBlockNumber();

    const pendingBlock = await ethers.provider.send('eth_getBlockByNumber', ['latest', false]);
    const blockGasLimit = BigNumber.from(pendingBlock.gasLimit);

    let workTx = await stealthRelayer.connect(keeper).execute(
      harvestKeep3rV2StealthJob.address, // address _job,
      callData, // bytes memory _callData,
      stealthHash, // bytes32 _stealthHash,
      blockNumber + 1, // uint256 _blockNumber
      { gasLimit: blockGasLimit.sub(15_000) }
    );

    expect(await harvestKeep3rV2StealthJob.callStatic.workable(strategies[0].address)).to.be.false;
  });

  it('Should change requirements', async function () {
    // Change req (bond == WETH)
    await harvestKeep3rV2StealthJob.connect(owner).setKeep3rRequirements(
      config.contracts.mainnet.wethToken.address, // address _bond,
      e18.mul(1), // 1 WETH required // uint256 _minBond,
      0, // uint256 _earned,
      0, // uint256 _age,
      true, // bool _onlyEOA,
    );
  });

  it('Should bond in WETH and get paid in bonded KP3R', async function () {
    await evm.advanceTimeAndBlock(6 * 60 * 60); // 6 hours

    // populates work transaction
    const rawTx = await harvestKeep3rV2StealthJob.connect(anotherKeeper).populateTransaction.work(strategies[0].address);
    const callData = rawTx.data;

    const stealthHash = ethers.utils.solidityKeccak256(['string'], ['random-secret-hash-2']);
    let blockNumber = await ethers.provider.getBlockNumber();

    const pendingBlock = await ethers.provider.send('eth_getBlockByNumber', ['latest', false]);
    const blockGasLimit = BigNumber.from(pendingBlock.gasLimit);

    let workTx = await stealthRelayer.connect(anotherKeeper).execute(
      harvestKeep3rV2StealthJob.address, // address _job,
      callData, // bytes memory _callData,
      stealthHash, // bytes32 _stealthHash,
      blockNumber + 1, // uint256 _blockNumber
      { gasLimit: blockGasLimit.sub(15_000) }
    );

    expect(await harvestKeep3rV2StealthJob.callStatic.workable(strategies[0].address)).to.be.false;
  });
});
