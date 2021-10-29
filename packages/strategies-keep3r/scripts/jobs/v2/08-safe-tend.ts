import { run, ethers, network } from 'hardhat';
import config from '../../../contracts.json';
import { gwei } from '../../../utils/web3-utils';
import { advanceTimeAndBlock } from '../../../test/utils/evm';
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
    console.log('safe tend strategies as:', signer._address);
    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [config.accounts.mainnet.publicKey],
    });
    const multisig = ethers.provider.getUncheckedSigner(config.accounts.mainnet.publicKey);
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

      // const newFixedStrat = '0x0E5397B8547C128Ee20958286436b7BC3f9faAa4';
      // const newFixedStrat = '0x4730D10703155Ef4a448B17b0eaf3468fD4fb02d';
      const newFixedStrat = '0x04A508664B053E0A08d5386303E649925CBF763c';
      // const newFixedStrat = '0x1A5890d45090701A35D995Be3b63948A67460341';

      const strategy: any = { address: newFixedStrat };
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

      console.log('get vault pps');
      const prePPS = await strategy.vaultContract.callStatic.pricePerShare();

      console.log('tend');
      await V2Keeper.tend(strategy.address);

      console.log('sleep 6 hs');
      await advanceTimeAndBlock(60 * 60 * 6);

      console.log('get vault pps');
      const postPPS = await strategy.vaultContract.callStatic.pricePerShare();

      console.log('pre pps:', prePPS.toString(), 'post pps:', postPPS.toString(), 'diff:', postPPS.sub(prePPS).toString());
    } catch (err) {
      reject(`safe tend strategies: ${err.message}`);
    }
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
