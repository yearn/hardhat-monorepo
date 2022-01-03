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
      let deployer;
      if (owner.address == accounts.yKeeper) {
        deployer = owner;
      } else {
        await hre.network.provider.request({
          method: 'hardhat_impersonateAccount',
          params: [accounts.yKeeper],
        });
        deployer = (owner.provider as any).getUncheckedSigner(accounts.yKeeper);
      }

      const V2Keeper: ContractFactory = await ethers.getContractFactory('V2Keeper');
      const v2Keeper = await V2Keeper.deploy(contracts.mechanicsRegistry.fantom);
      console.log('V2Keeper address:', v2Keeper.address);
      console.log('PLEASE: change .contracts.ts v2Keeper.fantom address to:', v2Keeper.address);

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
