const hre = require('hardhat');
const ethers = hre.ethers;
const { bn, e18, e18ToDecimal, ZERO_ADDRESS } = require('../../../utils/web3-utils');
const { v1Vaults } = require('../../../utils/v1-vaults');
const config = require('../../../.config.json');
const mainnetContracts = config.contracts.mainnet;

const { Confirm } = require('enquirer');
const confirm = new Confirm({
  message: 'Do you want to add vaults to vault keep3r job?',
});

async function main() {
  await hre.run('compile');
  await run();
}

function run() {
  return new Promise(async (resolve) => {
    // Setup deployer
    const [owner] = await ethers.getSigners();
    let deployer;
    if (owner.address == config.accounts.mainnet.deployer) {
      deployer = owner;
      deployer._address = owner.address;
    } else {
      await hre.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [config.accounts.mainnet.deployer],
      });
      deployer = owner.provider.getUncheckedSigner(config.accounts.mainnet.deployer);
    }

    const vaultKeep3rJob = await ethers.getContractAt('VaultKeep3rJob', mainnetContracts.jobs.vaultKeep3rJob, deployer);

    // Checks if local data matches chain data
    const addedVaults = await vaultKeep3rJob.vaults();
    for (const vault of v1Vaults) {
      const added = addedVaults.indexOf(vault.address) != -1;
      if (added && vault.added) continue;
      if (!added && !vault.added) continue;
      console.log(vault.name, vault.address);
      if (!added && vault.added) throw new Error('vault set as added but not on job');
      if (added && !vault.added) throw new Error('vault set as not-added but added on job');
    }

    const newV1Vaults = v1Vaults.filter((vault) => !vault.added);
    console.log('adding', newV1Vaults.length, 'new v1Vaults');
    console.log(newV1Vaults.map((vault) => vault.name).join(', '));

    if (newV1Vaults.length == 0) return;
    // Add crv vaults to crv keep3r
    if (!(await confirm.run())) return;

    console.time('addVaults');
    await vaultKeep3rJob.addVaults(
      newV1Vaults.map((vault) => vault.address),
      newV1Vaults.map((vault) => bn.from(10).pow(vault.decimals).mul(vault.requiredEarn)),
      { nonce: 1086 }
    );
    console.timeEnd('addVaults');

    resolve();
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
