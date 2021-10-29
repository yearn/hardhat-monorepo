import { run, ethers, network } from 'hardhat';
import { e18, ZERO_ADDRESS } from '../../../utils/web3-utils';
import * as contracts from '../../../utils/contracts';
import { v2StealthStrategies } from '../../../utils/v2-stealth-harvest-strategies';

const vaultAPIVersions = {
  default: 'contracts/interfaces/yearn/IVaultAPI.sol:VaultAPI',
  '0.3.0': 'contracts/interfaces/yearn/IVaultAPI.sol:VaultAPI',
  '0.3.2': 'contracts/interfaces/yearn/IVaultAPI_0_3_2_s.sol:VaultAPI',
};

async function main() {
  await run('compile');
  await promptAndSubmit();
}

function promptAndSubmit(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    const [owner] = await ethers.getSigners();
    console.log('using address:', owner.address);
    try {
      const harvestV2Keep3rStealthJob = await ethers.getContractAt('HarvestV2Keep3rStealthJob', contracts.harvestV2Keep3rStealthJob.mainnet);
      const strategiesAddresses = await harvestV2Keep3rStealthJob.callStatic.strategies();

      const strategies: any = strategiesAddresses.map((address: string) => ({
        address,
      }));
      console.log('strategies:', strategies.length());

      for (const strategy of strategies) {
        strategy.vault = await strategy.contract.callStatic.vault();
        strategy.vaultContract = await ethers.getContractAt(vaultAPIVersions['default'], strategy.vault);
        strategy.vaultAPIVersion = await strategy.vaultContract.apiVersion();
        strategy.vaultContract = await ethers.getContractAt(
          vaultAPIVersions[strategy.vaultAPIVersion as '0.3.0' | '0.3.2'] || vaultAPIVersions['0.3.2'],
          strategy.vault
        );

        const params = await strategy.vaultContract.callStatic.strategies(strategy.address);
        strategy.lastReport = params.lastReport;
        let debtRatio = params.debtRatio;
        if (debtRatio.eq(0)) {
          let totalAssets = await strategy.vaultContract.callStatic.totalAssets();
          let actualRatio = params.totalDebt.mul(10000).div(totalAssets);
          if (actualRatio.lt(10)) {
            // 0.1% in BPS
            await harvestV2Keep3rStealthJob.removeStrategy(strategy.address);
          }
        }
      }

      resolve();
    } catch (err) {
      reject(`Error while deploying v2 keep3r job contracts: ${err.message}`);
    }
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
