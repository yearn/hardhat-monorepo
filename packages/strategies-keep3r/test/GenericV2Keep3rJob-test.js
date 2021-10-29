const { expect } = require('chai');
const config = require('../.config.json');
const { e18, ZERO_ADDRESS, e18ToDecimal } = require('../utils/web3-utils');
const Actions = {
  0: 'none',
  1: 'addLiquidityToJob',
  2: 'applyCreditToJob',
  3: 'removeLiquidityFromJob',
};
const escrowContracts = config.contracts.mainnet.escrow;
const genericV2Keep3rJobContracts = config.contracts.mainnet.genericV2Keep3rJob;

describe('GenericV2Keep3rJob', function () {
  let owner;
  let alice;
  let Keep3rSugarMommy, keep3rSugarMommy;
  let GenericV2Keep3rJob, genericV2Keep3rJob;
  before('Setup accounts and contracts', async () => {
    Keep3rSugarMommy = await ethers.getContractFactory('Keep3rSugarMommy');
    GenericV2Keep3rJob = await ethers.getContractFactory('GenericV2Keep3rJob');
    [owner, alice] = await ethers.getSigners();
  });

  it('full deployment and setup', async function () {
    // impersonate keep3rGovernance
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [config.accounts.mainnet.keep3rGovernance],
    });
    const keep3rGovernance = owner.provider.getUncheckedSigner(config.accounts.mainnet.keep3rGovernance);
    // Setup deployer
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [config.accounts.mainnet.deployer],
    });
    const deployer = owner.provider.getUncheckedSigner(config.accounts.mainnet.deployer);
    // impersonate keeper
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [config.accounts.mainnet.keeper],
    });
    const keeper = owner.provider.getUncheckedSigner(config.accounts.mainnet.keeper);
    // impersonate strategist
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: ['0xc3d6880fd95e06c816cb030fac45b3ffe3651cb0'],
    });
    const strategist = owner.provider.getUncheckedSigner('0xc3d6880fd95e06c816cb030fac45b3ffe3651cb0');

    const keep3r = await ethers.getContractAt('IKeep3rV1', escrowContracts.keep3r, keep3rGovernance);
    keep3rSugarMommy = await ethers.getContractAt('Keep3rSugarMommy', escrowContracts.sugarMommy, deployer);

    genericV2Keep3rJob = (
      await GenericV2Keep3rJob.deploy(
        escrowContracts.sugarMommy,
        escrowContracts.keep3r,
        genericV2Keep3rJobContracts.keep3rHelper,
        genericV2Keep3rJobContracts.slidingOracle,
        6 * 60 * 60, // 6 hours
        10 * 60, // 10 minutes
        e18.mul(50)
      )
    ).connect(keeper);

    // Add strategies to genericV2Keep3rJob
    const strategies = [
      {
        address: '0x4031afd3B0F71Bace9181E554A9E680Ee4AbE7dF',
        harvest: 2_000_000,
        tend: 2_000_000,
        name: 'DAI Lev Comp',
      },
      {
        address: '0x4D7d4485fD600c61d840ccbeC328BfD76A050F87',
        harvest: 2_000_000,
        tend: 2_000_000,
        name: 'USDC Lev Comp',
      },
      {
        address: '0x7D960F3313f3cB1BBB6BF67419d303597F3E2Fa8',
        harvest: 1_000_000,
        tend: 0,
        name: 'DAI AH Earn',
      },
      {
        address: '0x86Aa49bf28d03B1A4aBEb83872cFC13c89eB4beD',
        harvest: 1_000_000,
        tend: 0,
        name: 'USDC AH Earn',
      },
      {
        address: '0x979843B8eEa56E0bEA971445200e0eC3398cdB87',
        harvest: 1_500_000,
        tend: 0,
        name: 'stETH Curve:',
      },
    ];
    await genericV2Keep3rJob.connect(owner).addStrategies(
      strategies.map((strategy) => strategy.address),
      strategies.map((strategy) => e18.mul(strategy.harvest)),
      strategies.map((strategy) => e18.mul(strategy.tend))
    );

    // DONE ^^

    // set keeper to genericV2Keep3rJob on strategies
    for (const strategy of strategies) {
      strategy.contract = await ethers.getContractAt('IBaseStrategy', strategy.address, strategist);
      await strategy.contract.setKeeper(genericV2Keep3rJob.address);
    }

    await keep3rSugarMommy.addValidJob(genericV2Keep3rJob.address);

    console.log('maxCredits:', e18ToDecimal(await genericV2Keep3rJob.maxCredits()));
    console.log('usedCredits:', e18ToDecimal(await genericV2Keep3rJob.usedCredits()));

    const remoteStrategies = await genericV2Keep3rJob.strategies();
    expect(strategies.map((s) => s.address)).to.be.deep.eq(remoteStrategies);

    for (const strategy of strategies) {
      console.log(strategy.name);
      if (strategy.harvest > 0) {
        strategy.harvestable = await genericV2Keep3rJob.harvestable(strategy.address);
        console.log('harvestable:', strategy.harvestable);
      }
      if (strategy.tend > 0) {
        strategy.tendable = await genericV2Keep3rJob.tendable(strategy.address);
        console.log('tendable:', strategy.tendable);
      }
    }

    for (const strategy of strategies) {
      if (strategy.harvestable) {
        console.log('harvesting:', strategy.name);
        await genericV2Keep3rJob.harvest(strategy.address);
        await expect(genericV2Keep3rJob.harvestable(strategy.address)).to.be.revertedWith(
          'generic-keep3r-v2::harvestable:strategy-harvest-cooldown'
        );
      }
      if (strategy.tendable) {
        console.log('tending:', strategy.name);
        strategy.tendable = await genericV2Keep3rJob.tendable(strategy.address);
        await expect(genericV2Keep3rJob.tendable(strategy.address)).to.be.revertedWith('generic-keep3r-v2::tendable:strategy-tend-cooldown');
      }
    }

    console.log('usedCredits:', e18ToDecimal(await genericV2Keep3rJob.usedCredits()));
  });
});
