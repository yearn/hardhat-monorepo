import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { e18, ZERO_ADDRESS } from '../../utils/web3-utils';
import config from '../../contracts.json';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract, ContractFactory } from 'ethers';
import { wallet } from '@test-utils';

const mainnetContracts = config.contracts.mainnet;
const mechanicsContracts = config.contracts.mainnet.mechanics;
const genericV2Keep3rJobContracts = config.contracts.mainnet.genericV2Keep3rJob;

const lowerCaseArray = (array: string[]) => array.map((address: string) => address.toLowerCase());

describe('HarvestV2QueueKeep3rJob', () => {
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

    const HarvestV2QueueKeep3rJob = await ethers.getContractFactory('HarvestV2QueueKeep3rJob');

    const harvestV2QueueKeep3rJob = (
      await HarvestV2QueueKeep3rJob.deploy(
        mechanicsContracts.registry,
        config.contracts.mainnet.keep3r.address,
        ZERO_ADDRESS,
        e18.mul(50), // 50 KP3R required
        0,
        0,
        true,
        v2Keeper.address,
        6 * 60 * 60 // 6 hours
      )
    ).connect(owner);

    // Add as valid job
    await v2Keeper.addJob(harvestV2QueueKeep3rJob.address);

    // Add to keep3r
    const keep3r = await ethers.getContractAt('IKeep3rV1', config.contracts.mainnet.keep3r.address, keep3rGovernance);
    await keep3r.addJob(harvestV2QueueKeep3rJob.address);
    await keep3r.addKPRCredit(harvestV2QueueKeep3rJob.address, e18.mul(100));

    // Add strategies to job
    const oldHarvestV2Keep3rJob = await ethers.getContractAt('HarvestV2Keep3rJob', mainnetContracts.proxyJobs.harvestV2Keep3rJob);
    const strategies = [
      {
        address: '0x32b8c26d0439e1959cea6262cbabc12320b384c4',
        requiredAmount: null,
      },
      {
        address: '0x979843B8eEa56E0bEA971445200e0eC3398cdB87',
        requiredAmount: null,
      },
      {
        address: '0x4d7d4485fd600c61d840ccbec328bfd76a050f87',
        requiredAmount: null,
      },
      {
        address: '0x4031afd3b0f71bace9181e554a9e680ee4abe7df',
        requiredAmount: null,
      },
      {
        address: '0xee697232df2226c9fb3f02a57062c4208f287851',
        requiredAmount: null,
      },
    ];

    for (const strategy of strategies) {
      strategy.requiredAmount = await oldHarvestV2Keep3rJob.requiredAmount(strategy.address);
    }

    // set reward multiplier
    await harvestV2QueueKeep3rJob.setRewardMultiplier(800);

    // Add harvest strategies
    const mainQueue = [strategies[4].address, strategies[2].address, strategies[3].address, strategies[0].address];
    const mainQueueRequiredAmounts = [
      strategies[4].requiredAmount,
      strategies[2].requiredAmount,
      strategies[3].requiredAmount,
      strategies[0].requiredAmount,
    ];
    await harvestV2QueueKeep3rJob.setStrategy(strategies[0].address, mainQueue, mainQueueRequiredAmounts);

    const mainStrategy = strategies[0].address;

    const jobStrategies = await harvestV2QueueKeep3rJob.strategies();
    expect(lowerCaseArray(jobStrategies)).to.be.deep.eq(lowerCaseArray([mainStrategy]));

    const strategyQueue = await harvestV2QueueKeep3rJob.strategyQueueList(mainStrategy);

    expect(lowerCaseArray(strategyQueue)).to.be.deep.eq(lowerCaseArray(mainQueue));

    let workable = await harvestV2QueueKeep3rJob.workable(mainStrategy);
    console.log({ workable });

    let workTx = await harvestV2QueueKeep3rJob.connect(keeper).work(mainStrategy);
    let workTxData = await workTx.wait();
    console.log('gasUsed:', workTxData.cumulativeGasUsed.toNumber());

    await expect(harvestV2QueueKeep3rJob.workable(mainStrategy)).to.be.revertedWith('V2QueueKeep3rJob::main-workable:on-cooldown');
  });
});
