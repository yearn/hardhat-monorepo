const hre = require('hardhat');
const ethers = hre.ethers;
const { bn, e18, e18ToDecimal, ZERO_ADDRESS } = require('../../../utils/web3-utils');
const { v1Vaults } = require('../../../utils/v1-vaults');
const config = require('../../../.config.json');
const mainnetContracts = config.contracts.mainnet;

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
      if (addedVaults.indexOf(vault.address) == -1) continue;
      const requiredEarn = await vaultKeep3rJob.requiredEarn(vault.address);
      console.log(vault.name, vault.address, requiredEarn.toString());
    }

    resolve();
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
