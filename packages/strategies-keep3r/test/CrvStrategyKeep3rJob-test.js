const { expect } = require('chai');
const config = require('../.config.json');
const { e18, ZERO_ADDRESS, e18ToDecimal } = require('../utils/web3-utils');
const escrowContracts = config.contracts.mainnet.escrow;

describe('CrvStrategyKeep3rJob', function () {
  let owner;
  let alice;
  before('Setup accounts and contracts', async () => {
    [owner, alice] = await ethers.getSigners();
  });

  it('Should deploy on mainnet fork', async function () {
    // impersonate keep3rGovernance
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [config.accounts.mainnet.keep3rGovernance],
    });
    const keep3rGovernance = owner.provider.getUncheckedSigner(config.accounts.mainnet.keep3rGovernance);
    // impersonate deployer
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
    // impersonate multisig
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [config.accounts.mainnet.publicKey],
    });
    const multisig = owner.provider.getUncheckedSigner(config.accounts.mainnet.publicKey);

    const keep3r = await ethers.getContractAt('IKeep3rV1', escrowContracts.keep3r, keep3rGovernance);
    const keep3rSugarMommy = await ethers.getContractAt('Keep3rSugarMommy', escrowContracts.sugarMommy, deployer);

    // deploy crvStrategyKeep3rJob
    const CrvStrategyKeep3rJob = await ethers.getContractFactory('CrvStrategyKeep3rJob');
    const crvStrategyKeep3rJob = (await CrvStrategyKeep3rJob.deploy(keep3rSugarMommy.address)).connect(owner);

    // Add crv job to sugarmommy
    await keep3rSugarMommy.addValidJob(crvStrategyKeep3rJob.address);
    // Give SugarMommy some credits
    await keep3r.addKPRCredit(keep3rSugarMommy.address, e18.mul(100));

    // Setup crv strategies
    const ycrvContract = await ethers.getContractAt('StrategyCurveYVoterProxy', config.contracts.mainnet.ycrv.address, owner);
    const busdContract = await ethers.getContractAt('StrategyCurveYVoterProxy', config.contracts.mainnet.busd.address, owner);
    const sbtcContract = await ethers.getContractAt('StrategyCurveYVoterProxy', config.contracts.mainnet.sbtc.address, owner);
    const pool3Contract = await ethers.getContractAt('StrategyCurveYVoterProxy', config.contracts.mainnet.pool3.address, owner);

    // Add crv strategies to crv keep3r
    console.time('addStrategies');
    const requiredHarvestAmount = e18.mul(100);
    await crvStrategyKeep3rJob.addStrategies(
      [ycrvContract.address, busdContract.address, sbtcContract.address, pool3Contract.address],
      [requiredHarvestAmount, requiredHarvestAmount, requiredHarvestAmount, requiredHarvestAmount]
    );
    console.timeEnd('addStrategies');

    console.time('strategies');
    const strategies = await crvStrategyKeep3rJob.strategies();
    expect(strategies).to.be.deep.eq([ycrvContract.address, busdContract.address, sbtcContract.address, pool3Contract.address]);
    console.timeEnd('strategies');

    console.time('updateRequiredHarvestAmount');
    await crvStrategyKeep3rJob.updateRequiredHarvestAmount(ycrvContract.address, requiredHarvestAmount.mul(2));
    await expect(crvStrategyKeep3rJob.updateRequiredHarvestAmount(ycrvContract.address, 0)).to.be.revertedWith(
      'crv-strategy-keep3r::set-required-harvest:should-not-be-zero'
    );
    console.timeEnd('updateRequiredHarvestAmount');

    console.time('removeStrategy');
    await crvStrategyKeep3rJob.removeStrategy(ycrvContract.address);
    await expect(crvStrategyKeep3rJob.removeStrategy(ycrvContract.address)).to.be.revertedWith(
      'crv-strategy-keep3r::remove-strategy:strategy-not-added'
    );
    await expect(crvStrategyKeep3rJob.updateRequiredHarvestAmount(ycrvContract.address, requiredHarvestAmount)).to.be.revertedWith(
      'crv-strategy-keep3r::update-required-harvest:strategy-not-added'
    );
    await expect(crvStrategyKeep3rJob.callStatic.workable(ycrvContract.address)).to.be.revertedWith(
      'crv-strategy-keep3r::workable:strategy-not-added'
    );
    console.timeEnd('removeStrategy');

    console.time('addStrategy');
    await expect(crvStrategyKeep3rJob.addStrategy(ycrvContract.address, 0)).to.be.revertedWith(
      'crv-strategy-keep3r::set-required-harvest:should-not-be-zero'
    );
    await crvStrategyKeep3rJob.addStrategy(ycrvContract.address, requiredHarvestAmount);
    await expect(crvStrategyKeep3rJob.addStrategy(ycrvContract.address, requiredHarvestAmount)).to.be.revertedWith(
      'crv-strategy-keep3r::add-strategy:strategy-already-added'
    );
    console.timeEnd('addStrategy');

    console.time('calculateHarvest');
    console.log('calculateHarvest(ycrv)', e18ToDecimal(await crvStrategyKeep3rJob.callStatic.calculateHarvest(ycrvContract.address)));
    console.log('calculateHarvest(busd)', e18ToDecimal(await crvStrategyKeep3rJob.callStatic.calculateHarvest(busdContract.address)));
    console.log('calculateHarvest(sbtc)', e18ToDecimal(await crvStrategyKeep3rJob.callStatic.calculateHarvest(sbtcContract.address)));
    console.log('calculateHarvest(pool3)', e18ToDecimal(await crvStrategyKeep3rJob.callStatic.calculateHarvest(pool3Contract.address)));
    console.timeEnd('calculateHarvest');

    console.time('workable');
    console.log('workable(ycrv)', await crvStrategyKeep3rJob.callStatic.workable(ycrvContract.address));
    console.log('workable(busd)', await crvStrategyKeep3rJob.callStatic.workable(busdContract.address));
    console.log('workable(sbtc)', await crvStrategyKeep3rJob.callStatic.workable(sbtcContract.address));
    console.log('workable(pool3)', await crvStrategyKeep3rJob.callStatic.workable(pool3Contract.address));
    console.timeEnd('workable');

    console.time('work should revert on ycrv');
    await expect(crvStrategyKeep3rJob.work(ycrvContract.address)).to.be.revertedWith('keep3rSugarMommy::isKeeper:keeper-not-min-requirements');
    console.timeEnd('work should revert on ycrv');

    console.time('set crvStrategyKeep3rJob as strategist');
    await ycrvContract.connect(multisig).setStrategist(crvStrategyKeep3rJob.address);
    await busdContract.connect(multisig).setStrategist(crvStrategyKeep3rJob.address);
    await sbtcContract.connect(multisig).setStrategist(crvStrategyKeep3rJob.address);
    await pool3Contract.connect(multisig).setStrategist(crvStrategyKeep3rJob.address);
    console.timeEnd('set crvStrategyKeep3rJob as strategist');

    console.time('work busd, sbtc and pool3');
    console.log('work(busd)');
    await crvStrategyKeep3rJob.connect(keeper).work(busdContract.address);
    console.log('work(sbtc)');
    await crvStrategyKeep3rJob.connect(keeper).work(sbtcContract.address);
    console.log('work(pool3)');
    await crvStrategyKeep3rJob.connect(keeper).work(pool3Contract.address);
    console.timeEnd('work busd, sbtc and pool3');

    console.time('forceWork ycrv makes workable false');
    await crvStrategyKeep3rJob.forceWork(ycrvContract.address);
    expect(await crvStrategyKeep3rJob.callStatic.workable(ycrvContract.address)).to.be.false;
    console.timeEnd('forceWork ycrv makes workable false');

    console.time('keeper work reverts with not-workable');
    await expect(crvStrategyKeep3rJob.connect(keeper).work(ycrvContract.address)).to.be.revertedWith(
      'crv-strategy-keep3r::harvest:not-workable'
    );
    console.timeEnd('keeper work reverts with not-workable');
  });
});
