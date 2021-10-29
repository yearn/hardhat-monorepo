const { expect } = require('chai');
const config = require('../.config.json');
const { e18, ZERO_ADDRESS } = require('../utils/web3-utils');

describe('DforceStrategyKeep3r', function () {
  let owner;
  let alice;
  before('Setup accounts and contracts', async () => {
    [owner, alice] = await ethers.getSigners();
  });

  it('Should deploy new DforceStrategyKeep3r with keep3r', async function () {
    const DforceStrategyKeep3r = await ethers.getContractFactory('DforceStrategyKeep3r');
    const dforceStrategyKeep3r = await DforceStrategyKeep3r.deploy(config.contracts.mainnet.keep3r.address, ZERO_ADDRESS, 0, 0, 0, true);
    const isDforceStrategyKeep3r = await dforceStrategyKeep3r.isDforceStrategyKeep3r();
    expect(isDforceStrategyKeep3r).to.be.true;
  });

  it('Should deploy on mainnet fork', async function () {
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [config.accounts.mainnet.publicKey],
    });
    const multisig = owner.provider.getUncheckedSigner(config.accounts.mainnet.publicKey);

    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [config.accounts.mainnet.keeper],
    });
    const keeper = owner.provider.getUncheckedSigner(config.accounts.mainnet.keeper);

    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [config.accounts.mainnet.keep3rGovernance],
    });
    const keep3rGovernance = owner.provider.getUncheckedSigner(config.accounts.mainnet.keep3rGovernance);

    const DforceStrategyKeep3r = await ethers.getContractFactory('DforceStrategyKeep3r');
    const dforceStrategyKeep3r = (
      await DforceStrategyKeep3r.deploy(config.contracts.mainnet.keep3r.address, ZERO_ADDRESS, 0, 0, 0, true)
    ).connect(owner);

    // Setup dforce strategies
    const dforceusdcContract = await ethers.getContractAt('StrategyDForceUSDC', config.contracts.mainnet['dforce-usdc'].address, owner);
    const dforceusdtContract = await ethers.getContractAt('StrategyDForceUSDC', config.contracts.mainnet['dforce-usdt'].address, owner);

    // Add dforce strategies to dforce keep3r
    console.time('addStrategy');
    const requiredHarvestAmount = e18.mul(100);
    await dforceStrategyKeep3r.addStrategy(dforceusdcContract.address, requiredHarvestAmount);
    await dforceStrategyKeep3r.addStrategy(dforceusdtContract.address, requiredHarvestAmount);
    console.timeEnd('addStrategy');

    console.time('strategies');
    const strategies = await dforceStrategyKeep3r.strategies();
    expect(strategies).to.be.deep.eq([dforceusdcContract.address, dforceusdtContract.address]);
    console.timeEnd('strategies');

    console.time('updateRequiredHarvestAmount');
    await dforceStrategyKeep3r.updateRequiredHarvestAmount(dforceusdcContract.address, requiredHarvestAmount.mul(2));
    await expect(dforceStrategyKeep3r.updateRequiredHarvestAmount(dforceusdcContract.address, 0)).to.be.revertedWith(
      'dforce-strategy-keep3r::set-required-harvest:should-not-be-zero'
    );
    console.timeEnd('updateRequiredHarvestAmount');

    console.time('removeStrategy');
    await dforceStrategyKeep3r.removeStrategy(dforceusdcContract.address);
    await expect(dforceStrategyKeep3r.removeStrategy(dforceusdcContract.address)).to.be.revertedWith(
      'dforce-strategy-keep3r::remove-strategy:strategy-not-added'
    );
    await expect(dforceStrategyKeep3r.updateRequiredHarvestAmount(dforceusdcContract.address, requiredHarvestAmount)).to.be.revertedWith(
      'dforce-strategy-keep3r::update-required-harvest:strategy-not-added'
    );
    await expect(dforceStrategyKeep3r.callStatic.workable(dforceusdcContract.address)).to.be.revertedWith(
      'dforce-strategy-keep3r::workable:strategy-not-added'
    );
    console.timeEnd('removeStrategy');

    console.time('addStrategy');
    await expect(dforceStrategyKeep3r.addStrategy(dforceusdcContract.address, 0)).to.be.revertedWith(
      'dforce-strategy-keep3r::set-required-harvest:should-not-be-zero'
    );
    await dforceStrategyKeep3r.addStrategy(dforceusdcContract.address, requiredHarvestAmount);
    await expect(dforceStrategyKeep3r.addStrategy(dforceusdcContract.address, requiredHarvestAmount)).to.be.revertedWith(
      'dforce-strategy-keep3r::add-strategy:strategy-already-added'
    );
    console.timeEnd('addStrategy');

    console.time('calculateHarvest');
    console.log('calculateHarvest(dforceusdc)', (await dforceStrategyKeep3r.callStatic.calculateHarvest(dforceusdcContract.address)).toString());
    console.log('calculateHarvest(dforceusdt)', (await dforceStrategyKeep3r.callStatic.calculateHarvest(dforceusdtContract.address)).toString());
    console.timeEnd('calculateHarvest');

    console.time('workable');
    console.log('workable(dforceusdc)', await dforceStrategyKeep3r.callStatic.workable(dforceusdcContract.address));
    console.log('workable(dforceusdt)', await dforceStrategyKeep3r.callStatic.workable(dforceusdtContract.address));
    console.timeEnd('workable');

    console.time('harvest should revert on dforceusdc');
    await expect(dforceStrategyKeep3r.harvest(dforceusdcContract.address)).to.be.revertedWith('keep3r::isKeeper:keeper-is-not-registered');
    console.timeEnd('harvest should revert on dforceusdc');

    console.time('set dforceStrategyKeep3r as strategist');
    await dforceusdcContract.connect(multisig).setStrategist(dforceStrategyKeep3r.address);
    await dforceusdtContract.connect(multisig).setStrategist(dforceStrategyKeep3r.address);
    console.timeEnd('set dforceStrategyKeep3r as strategist');

    console.time('add dforceStrategyKeep3r as a job on keep3r');
    const keep3r = await ethers.getContractAt('IKeep3rV1', config.contracts.mainnet.keep3r.address, keep3rGovernance);
    await keep3r.addJob(dforceStrategyKeep3r.address);
    await keep3r.addKPRCredit(dforceStrategyKeep3r.address, e18.mul(10));
    console.timeEnd('add dforceStrategyKeep3r as a job on keep3r');

    if (await dforceStrategyKeep3r.callStatic.workable(dforceusdtContract.address)) {
      console.time('harvest dforceusdt');
      console.log('harvest(dforceusdt)');
      await dforceStrategyKeep3r.connect(keeper).harvest(dforceusdtContract.address);
      console.timeEnd('harvest dforceusdt');
    }

    console.time('forceHarvest dforceusdc makes workable false');
    await dforceStrategyKeep3r.forceHarvest(dforceusdcContract.address);
    expect(await dforceStrategyKeep3r.callStatic.workable(dforceusdcContract.address)).to.be.false;
    console.timeEnd('forceHarvest dforceusdc makes workable false');

    console.time('keeper harvest reverts with not-workable');
    await expect(dforceStrategyKeep3r.connect(keeper).harvest(dforceusdcContract.address)).to.be.revertedWith(
      'dforce-strategy-keep3r::harvest:not-workable'
    );
    console.timeEnd('keeper harvest reverts with not-workable');
  });
});
