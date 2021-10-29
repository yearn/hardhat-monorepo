import { run, ethers } from 'hardhat';
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
    const [owner] = await ethers.getSigners();
    const provider = ethers.getDefaultProvider();
    const signer = new ethers.Wallet('0x' + config.accounts.mainnet.privateKey).connect(provider);
    console.log('working v2 tend strategies as:', signer.address);
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
      const newFixedStrat = '0x1A5890d45090701A35D995Be3b63948A67460341';

      const strategies = await TendV2Keep3rJob.callStatic.strategies();

      for (const strategyAddress of [...strategies, newFixedStrat]) {
        const strategy: any = { address: strategyAddress };
        const workable = await TendV2Keep3rJob.callStatic.workable(strategy.address);
        console.log({ strategy: strategy.address, workable });
        if (!workable) continue;
        try {
          await TendV2Keep3rJob.callStatic.forceWork(strategy.address, {
            gasPrice,
          });
          // console.log('sending tx...')
          // await TendV2Keep3rJob.forceWork(strategy.address, { gasPriceDemo });
          // console.log('worked!');
        } catch (error) {
          console.log(`working v2 tend strategies: ${error.message}`);
        }
      }

      console.log('waiting 10 minutes...');
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
