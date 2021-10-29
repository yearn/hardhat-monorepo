import { run, ethers, network } from 'hardhat';
import config from '../../../contracts.json';
import { gwei } from '../../../utils/web3-utils';
import * as taichi from '../../../utils/taichi';
const { Confirm } = require('enquirer');
const vaultAPIVersions = {
  default: 'contracts/interfaces/yearn/IVaultAPI.sol:VaultAPI',
  '0.3.0': 'contracts/interfaces/yearn/IVaultAPI.sol:VaultAPI',
  '0.3.2': 'contracts/interfaces/yearn/IVaultAPI_0_3_2.sol:VaultAPI',
};

async function main() {
  await run('compile');
  await promptAndSubmit();
}

function promptAndSubmit(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    // Setup deployer
    const [owner] = await ethers.getSigners();
    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [config.accounts.mainnet.deployer],
    });
    const signer = ethers.provider.getUncheckedSigner(config.accounts.mainnet.deployer);
    console.log('working v2 tend strategies as:', signer._address);
    try {
      const gasResponse = await taichi.getGasPrice();
      console.log('taichi gasPrices:', {
        fast: Math.floor(gasResponse.data.fast / 10 ** 9),
        standard: Math.floor(gasResponse.data.standard / 10 ** 9),
        slow: Math.floor(gasResponse.data.slow / 10 ** 9),
      });
      const gasPrice = ethers.BigNumber.from(gasResponse.data.fast);
      const gasPriceDemo = ethers.BigNumber.from(1);

      const TendV2Keep3rJob = await ethers.getContractAt('TendV2Keep3rJob', '0x2ef7801c6A9d451EF20d0F513c738CC012C57bC3', signer);
      const V2Keeper = await ethers.getContractAt('V2Keeper', '0x736D7e3c5a6CB2CE3B764300140ABF476F6CFCCF', signer);
      const newFixedStrat = '0x1A5890d45090701A35D995Be3b63948A67460341';
      const strategies = await TendV2Keep3rJob.callStatic.strategies();
      // add new fixed-strat

      for (const strategyAddress of [...strategies, newFixedStrat]) {
        const strategy: any = { address: strategyAddress };
        strategy.contract = await ethers.getContractAt('IBaseStrategy', strategy.address, signer);
        strategy.vault = await strategy.contract.callStatic.vault();
        strategy.want = await strategy.contract.callStatic.want();
        strategy.name = await strategy.contract.callStatic.name();
        strategy.wantContract = await ethers.getContractAt('ERC20Mock', strategy.want, strategy.keeperAccount);
        strategy.wantSymbol = await strategy.wantContract.callStatic.symbol();
        strategy.wantBalancePre = await strategy.wantContract.callStatic.balanceOf(strategy.address);
        strategy.decimals = await strategy.wantContract.callStatic.decimals();
        // init default
        strategy.vaultContract = await ethers.getContractAt(vaultAPIVersions['0.3.2'], strategy.vault, strategy.keeperAccount);

        strategy.vaultTotalAssets = await strategy.vaultContract.callStatic.totalAssets();
        const workable = await strategy.contract.callStatic.tendTrigger(5000);
        console.log({
          strategy: strategy.address,
          workable,
        });
        if (!workable) continue;
        try {
          await V2Keeper.callStatic.tend(strategy.address, {
            gasPrice: gasPriceDemo,
          });
          console.log('sending tx...');
          await V2Keeper.tend(strategy.address, { gasPrice: gasPriceDemo });
          console.log('worked!');
        } catch (error) {
          console.log(`working v2 tend strategies: ${error.message}`);
        }
      }
    } catch (err) {
      reject(`working v2 tend strategies: ${err.message}`);
    }
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
