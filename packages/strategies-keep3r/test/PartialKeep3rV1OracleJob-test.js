const { expect } = require('chai');
const config = require('../.config.json');
const { e18, ZERO_ADDRESS, SIX_HOURS } = require('../utils/web3-utils');

describe('PartialKeep3rV1OracleJob', function () {
  let owner;
  let alice;
  before('Setup accounts and contracts', async () => {
    [owner, alice] = await ethers.getSigners();
  });

  it('Should deploy new PartialKeep3rV1OracleJob with keep3r', async function () {
    const OracleBondedKeeper = await ethers.getContractFactory('OracleBondedKeeper');
    const oracleBondedKeeper = await OracleBondedKeeper.deploy(
      config.contracts.mainnet.keep3r.address,
      config.contracts.mainnet.keep3rV1Oracle.address
    );
    const PartialKeep3rV1OracleJob = await ethers.getContractFactory('PartialKeep3rV1OracleJob');
    const partialKeep3rV1OracleJob = await PartialKeep3rV1OracleJob.deploy(
      config.contracts.mainnet.keep3r.address,
      ZERO_ADDRESS,
      e18.mul(200), // 200 KP3R required
      0,
      0,
      false,
      oracleBondedKeeper.address
    );
    const oracleBondedKeeperAddress = await partialKeep3rV1OracleJob.oracleBondedKeeper();
    expect(oracleBondedKeeperAddress).to.eq(oracleBondedKeeper.address);
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

    const OracleBondedKeeper = await ethers.getContractFactory('OracleBondedKeeper');
    const oracleBondedKeeper = (
      await OracleBondedKeeper.deploy(config.contracts.mainnet.keep3r.address, config.contracts.mainnet.keep3rV1Oracle.address)
    ).connect(owner);

    const PartialKeep3rV1OracleJob = await ethers.getContractFactory('PartialKeep3rV1OracleJob');
    const partialKeep3rV1OracleJob = (
      await PartialKeep3rV1OracleJob.deploy(
        config.contracts.mainnet.keep3r.address,
        ZERO_ADDRESS,
        e18.mul(200), // 200 KP3R required
        0,
        0,
        false,
        oracleBondedKeeper.address
      )
    ).connect(owner);

    const pairs = {
      KP3R_ETHPair: { address: '0x87fEbfb3AC5791034fD5EF1a615e9d9627C2665D' },
      YFI_ETHPair: { address: '0x2fDbAdf3C4D5A8666Bc06645B8358ab803996E28' },
      // _ETHPair: { address: '' },
      // _ETHPair: { address: '' },
    };

    // Setup pairs
    for (const pair in pairs) {
      pairs[pair].contract = await ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', pairs[pair].address, owner);
    }

    // Add pairs to pair keep3r
    console.time('partialKeep3rV1OracleJob addPair');
    for (const pair in pairs) {
      console.log(`partialKeep3rV1OracleJob.addPair(${pair})`, pairs[pair].address);
      await partialKeep3rV1OracleJob.addPair(pairs[pair].address);
    }
    console.timeEnd('partialKeep3rV1OracleJob addPair');

    console.time('pairs');
    const addedPairs = await partialKeep3rV1OracleJob.pairs();
    expect(addedPairs).to.be.deep.eq(Object.values(pairs).map((pair) => pair.contract.address));
    console.timeEnd('pairs');

    const KP3R_ETHPairContract = pairs['KP3R_ETHPair'].contract;
    const YFI_ETHPairContract = pairs['YFI_ETHPair'].contract;

    console.time('removePair');
    await partialKeep3rV1OracleJob.removePair(KP3R_ETHPairContract.address);
    await expect(partialKeep3rV1OracleJob.removePair(KP3R_ETHPairContract.address)).to.be.revertedWith(
      'PartialKeep3rV1OracleJob::remove-pair:pair-not-found'
    );

    await expect(partialKeep3rV1OracleJob.callStatic.workable(KP3R_ETHPairContract.address)).to.be.revertedWith(
      'PartialKeep3rV1OracleJob::workable:pair-not-found'
    );
    console.timeEnd('removePair');

    console.time('addPair');
    await partialKeep3rV1OracleJob.addPair(KP3R_ETHPairContract.address);
    await expect(partialKeep3rV1OracleJob.addPair(KP3R_ETHPairContract.address)).to.be.revertedWith(
      'PartialKeep3rV1OracleJob::add-pair:pair-already-added'
    );
    console.timeEnd('addPair');

    // Advance time to make job workable
    await network.provider.request({
      method: 'evm_increaseTime',
      params: [2000],
    });
    await network.provider.request({ method: 'evm_mine', params: [] });

    console.time('workable');
    expect(await partialKeep3rV1OracleJob.callStatic.workable(KP3R_ETHPairContract.address)).to.be.true;
    expect(await partialKeep3rV1OracleJob.callStatic.workable(YFI_ETHPairContract.address)).to.be.true;
    console.timeEnd('workable');

    console.time('work should revert on KP3R_ETHPair');
    await expect(partialKeep3rV1OracleJob.work(KP3R_ETHPairContract.address)).to.be.revertedWith('keep3r::isKeeper:keeper-not-min-requirements');
    console.timeEnd('work should revert on KP3R_ETHPair');

    console.time('add partialKeep3rV1OracleJob as a job on keep3r');
    const keep3r = await ethers.getContractAt('IKeep3rV1', config.contracts.mainnet.keep3r.address, keep3rGovernance);
    await keep3r.addJob(partialKeep3rV1OracleJob.address);
    await keep3r.addKPRCredit(partialKeep3rV1OracleJob.address, e18.mul(100));
    console.timeEnd('add partialKeep3rV1OracleJob as a job on keep3r');

    await expect(partialKeep3rV1OracleJob.connect(keeper).work(KP3R_ETHPairContract.address)).to.be.revertedWith(
      'OracleBondedKeeper::onlyValidJob:msg-sender-not-valid-job'
    );

    await oracleBondedKeeper.addJob(partialKeep3rV1OracleJob.address);

    await expect(partialKeep3rV1OracleJob.connect(keeper).work(KP3R_ETHPairContract.address)).to.be.revertedWith(
      '::isKeeper: keeper is not registered'
    );

    await keep3r.addVotes(oracleBondedKeeper.address, e18.mul(200));

    // Updates oracle :)
    // console.log('forceWork update KP3R_ETH pair')
    // await partialKeep3rV1OracleJob.forceWork(KP3R_ETHPairContract.address);

    console.time('work YFI_ETHPair');
    console.log('work(YFI_ETHPair)');
    await partialKeep3rV1OracleJob.connect(keeper).work(YFI_ETHPairContract.address);
    console.timeEnd('work YFI_ETHPair');

    console.time('forceWork KP3R_ETHPair makes workable false');
    await expect(partialKeep3rV1OracleJob.forceWork(YFI_ETHPairContract.address)).to.be.revertedWith(
      'PartialKeep3rV1OracleJob::force-work:pair-not-updated'
    );

    expect(await partialKeep3rV1OracleJob.callStatic.workable(YFI_ETHPairContract.address)).to.be.false;
    console.timeEnd('forceWork KP3R_ETHPair makes workable false');

    console.time('keeper work reverts with not-workable');
    await expect(partialKeep3rV1OracleJob.connect(keeper).work(YFI_ETHPairContract.address)).to.be.revertedWith(
      'PartialKeep3rV1OracleJob::work:not-workable'
    );
    console.timeEnd('keeper work reverts with not-workable');
  });
});
