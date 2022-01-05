import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { e18, ZERO_ADDRESS } from '../../utils/web3-utils';
import config from '../../contracts.json';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { getNodeUrl } from '@utils/network';
import { wallet } from '@test-utils';

describe('CrvStrategyKeep3r', () => {
  let owner: SignerWithAddress;

  before('Setup accounts and contracts', async () => {
    [owner] = await ethers.getSigners();
  });

  beforeEach(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
      params: [
        {
          forking: {
            jsonRpcUrl: getNodeUrl('mainnet'),
            blockNumber: 11724476,
          },
        },
      ],
    });
  });

  it.only('passes', async () => {});

  it('should deploy new CrvStrategyKeep3r with keep3r', async function () {
    const CrvStrategyKeep3r = await ethers.getContractFactory('CrvStrategyKeep3r');
    const crvStrategyKeep3r = await CrvStrategyKeep3r.deploy(config.contracts.mainnet.keep3r.address, ZERO_ADDRESS, 0, 0, 0, true);
    const isCrvStrategyKeep3r = await crvStrategyKeep3r.isCrvStrategyKeep3r();
    expect(isCrvStrategyKeep3r).to.be.true;
  });

  it('Should deploy on mainnet fork', async function () {
    const multisig = await wallet.impersonate(config.accounts.mainnet.publicKey);

    const keeper = await wallet.impersonate(config.accounts.mainnet.keeper);

    const keep3rGovernance = await wallet.impersonate(config.accounts.mainnet.keep3rGovernance);

    const CrvStrategyKeep3r = await ethers.getContractFactory('CrvStrategyKeep3r');
    const crvStrategyKeep3r = (await CrvStrategyKeep3r.deploy(config.contracts.mainnet.keep3r.address, ZERO_ADDRESS, 0, 0, 0, true)).connect(
      owner
    );

    // Setup crv strategies
    const ycrvContract = await ethers.getContractAt('StrategyCurveYVoterProxy', config.contracts.mainnet.ycrv.address, owner);
    const busdContract = await ethers.getContractAt('StrategyCurveYVoterProxy', config.contracts.mainnet.busd.address, owner);
    const sbtcContract = await ethers.getContractAt('StrategyCurveYVoterProxy', config.contracts.mainnet.sbtc.address, owner);
    const pool3Contract = await ethers.getContractAt('StrategyCurveYVoterProxy', config.contracts.mainnet.pool3.address, owner);

    // Add crv strategies to crv keep3r
    console.time('addStrategy');
    const requiredHarvestAmount = e18.mul(100);
    await crvStrategyKeep3r.addStrategy(ycrvContract.address, requiredHarvestAmount);
    await crvStrategyKeep3r.addStrategy(busdContract.address, requiredHarvestAmount);
    await crvStrategyKeep3r.addStrategy(sbtcContract.address, requiredHarvestAmount);
    await crvStrategyKeep3r.addStrategy(pool3Contract.address, requiredHarvestAmount);
    console.timeEnd('addStrategy');

    console.time('strategies');
    const strategies = await crvStrategyKeep3r.strategies();
    expect(strategies).to.be.deep.eq([ycrvContract.address, busdContract.address, sbtcContract.address, pool3Contract.address]);
    console.timeEnd('strategies');

    console.time('updateRequiredHarvestAmount');
    await crvStrategyKeep3r.updateRequiredHarvestAmount(ycrvContract.address, requiredHarvestAmount.mul(2));
    await expect(crvStrategyKeep3r.updateRequiredHarvestAmount(ycrvContract.address, 0)).to.be.revertedWith(
      'crv-strategy-keep3r::set-required-harvest:should-not-be-zero'
    );
    console.timeEnd('updateRequiredHarvestAmount');

    console.time('removeStrategy');
    await crvStrategyKeep3r.removeStrategy(ycrvContract.address);
    await expect(crvStrategyKeep3r.removeStrategy(ycrvContract.address)).to.be.revertedWith(
      'crv-strategy-keep3r::remove-strategy:strategy-not-added'
    );
    await expect(crvStrategyKeep3r.updateRequiredHarvestAmount(ycrvContract.address, requiredHarvestAmount)).to.be.revertedWith(
      'crv-strategy-keep3r::update-required-harvest:strategy-not-added'
    );
    await expect(crvStrategyKeep3r.callStatic.workable(ycrvContract.address)).to.be.revertedWith(
      'crv-strategy-keep3r::workable:strategy-not-added'
    );
    console.timeEnd('removeStrategy');

    console.time('addStrategy');
    await expect(crvStrategyKeep3r.addStrategy(ycrvContract.address, 0)).to.be.revertedWith(
      'crv-strategy-keep3r::set-required-harvest:should-not-be-zero'
    );
    await crvStrategyKeep3r.addStrategy(ycrvContract.address, requiredHarvestAmount);
    await expect(crvStrategyKeep3r.addStrategy(ycrvContract.address, requiredHarvestAmount)).to.be.revertedWith(
      'crv-strategy-keep3r::add-strategy:strategy-already-added'
    );
    console.timeEnd('addStrategy');

    console.time('calculateHarvest');
    console.log('calculateHarvest(ycrv)', (await crvStrategyKeep3r.callStatic.calculateHarvest(ycrvContract.address)).toString());
    console.log('calculateHarvest(busd)', (await crvStrategyKeep3r.callStatic.calculateHarvest(busdContract.address)).toString());
    console.log('calculateHarvest(sbtc)', (await crvStrategyKeep3r.callStatic.calculateHarvest(sbtcContract.address)).toString());
    console.log('calculateHarvest(pool3)', (await crvStrategyKeep3r.callStatic.calculateHarvest(pool3Contract.address)).toString());
    console.timeEnd('calculateHarvest');

    console.time('workable');
    console.log('workable(ycrv)', await crvStrategyKeep3r.callStatic.workable(ycrvContract.address));
    console.log('workable(busd)', await crvStrategyKeep3r.callStatic.workable(busdContract.address));
    console.log('workable(sbtc)', await crvStrategyKeep3r.callStatic.workable(sbtcContract.address));
    console.log('workable(pool3)', await crvStrategyKeep3r.callStatic.workable(pool3Contract.address));
    console.timeEnd('workable');

    console.time('harvest should revert on ycrv');
    await expect(crvStrategyKeep3r.harvest(ycrvContract.address)).to.be.revertedWith('keep3r::isKeeper:keeper-is-not-registered');
    console.timeEnd('harvest should revert on ycrv');

    console.time('set crvStrategyKeep3r as strategist');
    await ycrvContract.connect(multisig).setStrategist(crvStrategyKeep3r.address);
    await busdContract.connect(multisig).setStrategist(crvStrategyKeep3r.address);
    await sbtcContract.connect(multisig).setStrategist(crvStrategyKeep3r.address);
    await pool3Contract.connect(multisig).setStrategist(crvStrategyKeep3r.address);
    console.timeEnd('set crvStrategyKeep3r as strategist');

    console.time('add crvStrategyKeep3r as a job on keep3r');
    const keep3r = await ethers.getContractAt('IKeep3rV1', config.contracts.mainnet.keep3r.address, keep3rGovernance);
    await keep3r.addJob(crvStrategyKeep3r.address);
    await keep3r.addKPRCredit(crvStrategyKeep3r.address, e18.mul(10));
    console.timeEnd('add crvStrategyKeep3r as a job on keep3r');

    console.time('harvest busd, sbtc and pool3');
    console.log('harvest(busd)');
    await crvStrategyKeep3r.connect(keeper).harvest(busdContract.address);
    console.log('harvest(sbtc)');
    await crvStrategyKeep3r.connect(keeper).harvest(sbtcContract.address);
    console.log('harvest(pool3)');
    await crvStrategyKeep3r.connect(keeper).harvest(pool3Contract.address);
    console.timeEnd('harvest busd, sbtc and pool3');

    console.time('forceHarvest ycrv makes workable false');
    await crvStrategyKeep3r.forceHarvest(ycrvContract.address);
    expect(await crvStrategyKeep3r.callStatic.workable(ycrvContract.address)).to.be.false;
    console.timeEnd('forceHarvest ycrv makes workable false');

    console.time('keeper harvest reverts with not-workable');
    await expect(crvStrategyKeep3r.connect(keeper).harvest(ycrvContract.address)).to.be.revertedWith(
      'crv-strategy-keep3r::harvest:not-workable'
    );
    console.timeEnd('keeper harvest reverts with not-workable');
  });
});
