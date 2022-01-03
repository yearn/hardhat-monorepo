import hre from 'hardhat';
import { ContractFactory } from 'ethers';
const ethers = hre.ethers;
import * as accounts from '../../utils/accounts';
import * as contracts from '../../utils/contracts';

async function main() {
  await hre.run('compile');
  await promptAndSubmit();
}

function promptAndSubmit() {
  return new Promise<void>(async (resolve, reject) => {
    try {
      // Setup deployer
      const [owner] = await ethers.getSigners();
      console.log('using', owner.address);
      let deployer;
      if (owner.address == accounts.yKeeper) {
        deployer = owner;
      } else {
        console.log('impersonating', accounts.yKeeper);
        await hre.network.provider.request({
          method: 'hardhat_impersonateAccount',
          params: [accounts.yKeeper],
        });
        deployer = (owner.provider as any).getUncheckedSigner(accounts.yKeeper);
      }

      const VaultsRegistryHelper: ContractFactory = await ethers.getContractFactory('VaultsRegistryHelper');
      console.log(contracts.vaultsRegistry.fantom);
      const vaultsRegistryHelper = await VaultsRegistryHelper.deploy(contracts.vaultsRegistry.fantom);
      console.log('VaultsRegistryHelper address:', vaultsRegistryHelper.address);
      console.log('PLEASE: change .contracts.ts vaultsRegistryHelper.fantom address to:', vaultsRegistryHelper.address);

      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
