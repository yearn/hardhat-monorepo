import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { e18, ZERO_ADDRESS } from '../../utils/web3-utils';
import config from '../../.config.json';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import * as contracts from '../../utils/contracts';
import * as yOracleContracts from '@lbertenasco/y-oracle/dist/utils/contracts';
import { wallet } from '@test-utils';

const mechanicsContracts = config.contracts.mainnet.mechanics;

const lowerCaseArray = (array: string[]) => array.map((address: string) => address.toLowerCase());

describe('CrvStrategyKeep3rStealthJob2', () => {
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

    const CrvStrategyKeep3rStealthJob2 = await ethers.getContractFactory('CrvStrategyKeep3rStealthJob2');

    const crvStrategyKeep3rStealthJob2 = (
      await CrvStrategyKeep3rStealthJob2.deploy(
        mechanicsContracts.registry,
        contracts.stealthRelayer.mainnet,
        config.contracts.mainnet.keep3r.address,
        ZERO_ADDRESS,
        e18.mul(50), // 50 KP3R required
        0,
        0,
        true,
        2 * 24 * 60 * 60, // 2 days maxHarvestPeriod,
        30 * 60, // 30 minutes harvestCooldown
        v2Keeper.address
      )
    ).connect(owner);

    // Add as valid job
    await v2Keeper.addJob(crvStrategyKeep3rStealthJob2.address);

    // Add to keep3r
    const keep3r = await ethers.getContractAt('IKeep3rV1', config.contracts.mainnet.keep3r.address, keep3rGovernance);
    await keep3r.addJob(crvStrategyKeep3rStealthJob2.address);
    await keep3r.addKPRCredit(crvStrategyKeep3rStealthJob2.address, e18.mul(100));

    // Add strategies to job
    const strategies = [
      {
        name: 'StrategyCurveUSDNVoterProxy',
        address: '0x406813fF2143d178d1Ebccd2357C20A424208912',
        requiredAmount: 1, // used to force workable :)
        requiredEarn: 100_000,
      },
      {
        name: 'StrategyCurveBTCVoterProxy',
        address: '0x6D6c1AD13A5000148Aa087E7CbFb53D402c81341',
        requiredAmount: 10_000,
        requiredEarn: 3,
      },
      {
        name: 'StrategystETHCurve',
        address: '0x979843B8eEa56E0bEA971445200e0eC3398cdB87',
        requiredAmount: 10_000,
        requiredEarn: 1_000_000, // v2
      },
    ];
    // set keeper to test strategy
    const strategyToTest = await ethers.getContractAt('IBaseStrategy', strategies[0].address, multisig);
    await strategyToTest.setKeeper(crvStrategyKeep3rStealthJob2.address);

    // set reward multiplier
    await crvStrategyKeep3rStealthJob2.setRewardMultiplier(950);

    for (const strategy of strategies) {
      await crvStrategyKeep3rStealthJob2.addStrategy(strategy.address, e18.mul(strategy.requiredAmount), e18.mul(strategy.requiredEarn));
    }

    const jobStrategies = await crvStrategyKeep3rStealthJob2.strategies();
    expect(lowerCaseArray(jobStrategies)).to.be.deep.eq(lowerCaseArray(strategies.map((s) => s.address)));

    console.log('checking if workable');
    let workable = await crvStrategyKeep3rStealthJob2.callStatic.workable(strategies[0].address);
    console.log({ workable });

    // Stealth contracts and setup
    const stealthVault = await ethers.getContractAt('IStealthVault', contracts.stealthVault.mainnet as string, deployer);
    const stealthRelayer = await ethers.getContractAt('IStealthRelayer', contracts.stealthRelayer.mainnet as string, deployer);
    // Set job in stealth relayer
    await stealthRelayer.addJob(crvStrategyKeep3rStealthJob2.address);

    // keeper stealthVault setup
    const penalty = await stealthRelayer.callStatic.penalty();
    await stealthVault.connect(keeper).bond({ value: penalty });
    // Already added
    // await stealthVault
    //   .connect(keeper)
    //   .enableStealthContract(stealthRelayer.address);

    // populates work transaction
    const rawTx = await crvStrategyKeep3rStealthJob2.populateTransaction.work(strategies[0].address);
    const callData = rawTx.data;

    const stealthHash = ethers.utils.solidityKeccak256(['string'], ['random-secret-hash-crv-stealth']);
    let blockNumber = await ethers.provider.getBlockNumber();

    const pendingBlock = await ethers.provider.send('eth_getBlockByNumber', ['latest', false]);
    const blockGasLimit = BigNumber.from(pendingBlock.gasLimit);

    let workTx = await stealthRelayer.connect(keeper).execute(
      crvStrategyKeep3rStealthJob2.address, // address _job,
      callData, // bytes memory _callData,
      stealthHash, // bytes32 _stealthHash,
      blockNumber + 1, // uint256 _blockNumber
      { gasLimit: blockGasLimit.sub(15_000) }
    );

    let workTxData = await workTx.wait();
    console.log('gasUsed:', workTxData.cumulativeGasUsed.toNumber());

    expect(await crvStrategyKeep3rStealthJob2.callStatic.workable(strategies[0].address)).to.be.false;
  });
});
