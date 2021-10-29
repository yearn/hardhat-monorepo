const { expect } = require('chai');
const config = require('../.config.json');
const { e18, ZERO_ADDRESS, SIX_HOURS } = require('../utils/web3-utils');

describe('VaultKeep3r', function () {
  let owner;
  let alice;
  before('Setup accounts and contracts', async () => {
    [owner, alice] = await ethers.getSigners();
  });

  it('Should deploy new VaultKeep3r with keep3r', async function () {
    const VaultKeep3r = await ethers.getContractFactory('VaultKeep3r');
    const vaultKeep3r = await VaultKeep3r.deploy(config.contracts.mainnet.keep3r.address, ZERO_ADDRESS, 0, 0, 0, true, SIX_HOURS);
    const isVaultKeep3r = await vaultKeep3r.isVaultKeep3r();
    expect(isVaultKeep3r).to.be.true;
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

    const VaultKeep3r = await ethers.getContractFactory('VaultKeep3r');
    const vaultKeep3r = (await VaultKeep3r.deploy(config.contracts.mainnet.keep3r.address, ZERO_ADDRESS, 0, 0, 0, true, SIX_HOURS)).connect(
      owner
    );

    const requiredEarnAmount = e18.mul(20000); // 20k default earn amount
    const vaults = {
      ycrvVault: { requiredEarnAmount },
      busdVault: { requiredEarnAmount },
      sbtcVault: { requiredEarnAmount: e18 },
      pool3Vault: { requiredEarnAmount },
      compVault: { requiredEarnAmount },
    };

    // Setup vaults
    for (const vault in vaults) {
      vaults[vault].contract = await ethers.getContractAt('yVault', config.contracts.mainnet[vault].address, owner);
    }

    // Add vaults to vault keep3r
    console.time('vaultKeep3r addVault');
    for (const vault in vaults) {
      console.log(
        `vaultKeep3r.addVault(${vault})`,
        config.contracts.mainnet[vault].address,
        vaults[vault].requiredEarnAmount.div(e18).toNumber()
      );
      await vaultKeep3r.addVault(config.contracts.mainnet[vault].address, vaults[vault].requiredEarnAmount);
    }
    console.timeEnd('vaultKeep3r addVault');

    console.time('vaults');
    const addedVaults = await vaultKeep3r.vaults();
    expect(addedVaults).to.be.deep.eq(Object.values(vaults).map((vault) => vault.contract.address));
    console.timeEnd('vaults');

    const ycrvVaultContract = vaults['ycrvVault'].contract;
    const busdVaultContract = vaults['busdVault'].contract;

    console.time('updateRequiredEarnAmount');
    await vaultKeep3r.updateRequiredEarnAmount(ycrvVaultContract.address, requiredEarnAmount.mul(2));
    await expect(vaultKeep3r.updateRequiredEarnAmount(ycrvVaultContract.address, 0)).to.be.revertedWith(
      'vault-keep3r::set-required-earn:should-not-be-zero'
    );
    console.timeEnd('updateRequiredEarnAmount');

    console.time('removeVault');
    await vaultKeep3r.removeVault(ycrvVaultContract.address);
    await expect(vaultKeep3r.removeVault(ycrvVaultContract.address)).to.be.revertedWith('vault-keep3r::remove-vault:vault-not-added');
    await expect(vaultKeep3r.updateRequiredEarnAmount(ycrvVaultContract.address, requiredEarnAmount)).to.be.revertedWith(
      'vault-keep3r::update-required-earn:vault-not-added'
    );
    await expect(vaultKeep3r.callStatic.workable(ycrvVaultContract.address)).to.be.revertedWith('vault-keep3r::workable:vault-not-added');
    console.timeEnd('removeVault');

    console.time('addVault');
    await expect(vaultKeep3r.addVault(ycrvVaultContract.address, 0)).to.be.revertedWith('vault-keep3r::set-required-earn:should-not-be-zero');
    await vaultKeep3r.addVault(ycrvVaultContract.address, requiredEarnAmount);
    await expect(vaultKeep3r.addVault(ycrvVaultContract.address, requiredEarnAmount)).to.be.revertedWith(
      'vault-keep3r::add-vault:vault-already-added'
    );
    console.timeEnd('addVault');

    console.time('calculateEarn');
    console.log('calculateEarn(ycrvVault)', (await vaultKeep3r.callStatic.calculateEarn(ycrvVaultContract.address)).toString());
    console.log('calculateEarn(busdVault)', (await vaultKeep3r.callStatic.calculateEarn(busdVaultContract.address)).toString());
    console.timeEnd('calculateEarn');

    console.time('workable');
    console.log('workable(ycrvVault)', await vaultKeep3r.callStatic.workable(ycrvVaultContract.address));
    console.log('workable(busdVault)', await vaultKeep3r.callStatic.workable(busdVaultContract.address));
    console.timeEnd('workable');

    console.time('earn should revert on ycrvVault');
    await expect(vaultKeep3r.earn(ycrvVaultContract.address)).to.be.revertedWith('keep3r::isKeeper:keeper-is-not-registered');
    console.timeEnd('earn should revert on ycrvVault');

    console.time('add vaultKeep3r as a job on keep3r');
    const keep3r = await ethers.getContractAt('IKeep3rV1', config.contracts.mainnet.keep3r.address, keep3rGovernance);
    await keep3r.addJob(vaultKeep3r.address);
    await keep3r.addKPRCredit(vaultKeep3r.address, e18.mul(10));
    console.timeEnd('add vaultKeep3r as a job on keep3r');

    const lastEarnAtBefore = await vaultKeep3r.callStatic.lastEarnAt(ycrvVaultContract.address);
    expect(lastEarnAtBefore).to.eq(0);

    console.time('earn busdVault');
    console.log('earn(busdVault)');
    await vaultKeep3r.connect(keeper).earn(busdVaultContract.address);
    console.timeEnd('earn busdVault');

    console.time('forceEarn ycrvVault makes workable false');
    await vaultKeep3r.forceEarn(ycrvVaultContract.address);
    expect(await vaultKeep3r.callStatic.workable(ycrvVaultContract.address)).to.be.false;
    console.timeEnd('forceEarn ycrvVault makes workable false');

    console.time('keeper earn reverts with not-workable');
    await expect(vaultKeep3r.connect(keeper).earn(ycrvVaultContract.address)).to.be.revertedWith('vault-keep3r::earn:not-workable');
    console.timeEnd('keeper earn reverts with not-workable');

    const lastEarnAtAfter = await vaultKeep3r.callStatic.lastEarnAt(ycrvVaultContract.address);
    expect(lastEarnAtBefore).to.be.lt(lastEarnAtAfter);
  });
});
