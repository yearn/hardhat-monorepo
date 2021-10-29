import { run, ethers } from 'hardhat';
import config from '../../../.config.json';
import { contracts } from '../../../contracts.json';
import { bn, e18, gwei } from '../../../utils/web3-utils';
import * as taichi from '../../../utils/taichi';
import { manualHarvestStrategies } from '../../../utils/v2-manual-harvest-strategies';
const { Confirm } = require('enquirer');
const sendTxPrompt = new Confirm({ message: 'Send tx?' });

async function main() {
  await run('compile');
  await promptAndSubmit();
}
const vaultAPIVersions = {
  default: 'contracts/interfaces/yearn/IVaultAPI.sol:VaultAPI',
  '0.3.0': 'contracts/interfaces/yearn/IVaultAPI.sol:VaultAPI',
  '0.3.2': 'contracts/interfaces/yearn/IVaultAPI_0_3_2_s.sol:VaultAPI',
};

function promptAndSubmit(): Promise<void | Error> {
  let nonceIncreasedBy = bn.from(0);
  return new Promise(async (resolve, reject) => {
    const [owner] = await ethers.getSigners();
    const provider = ethers.getDefaultProvider();
    const signer = new ethers.Wallet('0x' + config.accounts.mainnet.privateKey).connect(provider);
    console.log('working v2 harvest strategies as:', signer.address);
    const v2Keeper = await ethers.getContractAt('V2Keeper', contracts.mainnet.proxyJobs.v2Keeper, signer);
    const harvestV2Keep3rJob = await ethers.getContractAt('V2Keep3rJob', contracts.mainnet.oldJobs.harvestV2Keep3rJob);
    let strategiesAddresses: string[] = await harvestV2Keep3rJob.callStatic.strategies();

    // manually add extra strategies
    strategiesAddresses = [...strategiesAddresses, '0xe9bD008A97e362F7C501F6F5532A348d2e6B8131'];

    const baseStrategies: any = strategiesAddresses.map((address: string) => ({
      address,
    }));

    const strategiesToAvoid: any = [
      // from vault DAI yVault 0x19D3364A399d251E894aC732651be8B0E4e85001
      // from vault DAI yVault 0x19D3364A399d251E894aC732651be8B0E4e85001
      '0x32b8C26d0439e1959CEa6262CBabC12320b384c4',
      '0x32b8C26d0439e1959CEa6262CBabC12320b384c4',
      '0x9f51F4df0b275dfB1F74f6Db86219bAe622B36ca',
      '0x7D960F3313f3cB1BBB6BF67419d303597F3E2Fa8',
      '0x4d069f267DaAb537c4ff135556F711c0A6538496',
      // '0x3D6532c589A11117a4494d9725bb8518C731f1Be',
      '0xB361a3E75Bc2Ae6c8A045b3A43E2B0c9aD890d48',
      '0x57e848A6915455a7e77CF0D55A1474bEFd9C374d',
      '0x30010039Ea4a0c4fa1Ac051E8aF948239678353d',
      // from vault WETH yVault 0xa258C4606Ca8206D8aA700cE2143D7db854D168c
      // '0xec2DB4A1Ad431CC3b102059FA91Ba643620F0826',
      // '0xC5e385f7Dad49F230AbD53e21b06aA0fE8dA782D',
      // '0x37770F958447fFa1571fc9624BFB3d673161f37F',
      // '0xd28b508EA08f14A473a5F332631eA1972cFd7cC0',
      '0x5148C3124B42e73CA4e15EEd1B304DB59E0F2AF7',
      '0x2923a58c1831205C854DBEa001809B194FDb3Fa5',
      '0x2E1ad896D3082C52A5AE7Af307131DE7a37a46a0',
    ];

    // custom maxReportDelay and amount:
    const strategies = [...baseStrategies, ...manualHarvestStrategies];

    let harvestedCRV = false;
    try {
      const now = bn.from(Math.round(new Date().valueOf() / 1000));

      for (const strategy of strategies) {
        if (strategy.name) console.log('strategy', strategy.name, strategy.address);
        else console.log('strategy', strategy.address);
        if (strategiesToAvoid.indexOf(strategy.address) != -1) {
          console.log('avoiding...');
          continue;
        }
        strategy.contract = await ethers.getContractAt('IBaseStrategy', strategy.address, signer);
        try {
          strategy.isCRV = !!(await strategy.contract.callStatic.crv());
        } catch (error) {}
        strategy.maxReportDelay = strategy.maxReportDelay
          ? bn.from(Math.round(strategy.maxReportDelay))
          : await strategy.contract.callStatic.maxReportDelay();
        strategy.vault = await strategy.contract.callStatic.vault();
        strategy.vaultContract = await ethers.getContractAt(vaultAPIVersions['default'], strategy.vault, strategy.keeperAccount);
        strategy.vaultAPIVersion = await strategy.vaultContract.apiVersion();
        strategy.vaultContract = await ethers.getContractAt(
          vaultAPIVersions[strategy.vaultAPIVersion as '0.3.0' | '0.3.2'] || vaultAPIVersions['0.3.2'],
          strategy.vault,
          strategy.keeperAccount
        );
        const params = await strategy.vaultContract.callStatic.strategies(strategy.address);
        strategy.lastReport = params.lastReport;
        let debtRatio = params.debtRatio;
        if (debtRatio.eq(0)) {
          let totalAssets = await strategy.vaultContract.callStatic.totalAssets();
          let actualRatio = params.totalDebt.mul(10000).div(totalAssets);
          if (actualRatio.lt(10)) {
            // 0.1% in BPS
            console.log('avoiding due to zero debtRatio...');
            continue; // Ignore strategies which have no debtRatio AND no actualRatio
          }
        }
        const cooldownCompleted = strategy.lastReport.lt(now.sub(strategy.maxReportDelay));
        console.log('maxReportDelay hrs:', strategy.maxReportDelay.div(60 * 60).toNumber());
        console.log(
          'strategy over cooldown:',
          cooldownCompleted,
          ', will work in:',
          strategy.lastReport
            .add(strategy.maxReportDelay)
            .sub(now)
            .div(60 * 60)
            .toNumber(),
          'hours'
        );
        if (!cooldownCompleted && !strategy.amount) continue;
        if (!cooldownCompleted) {
          console.log('checking creditAvailable:');
          // vault.creditAvailable(strategy) >= amount -> do a harvest if true.
          const creditAvailable = await strategy.vaultContract.callStatic.creditAvailable(strategy.address);
          // if creditAvailable is less than amount, do not harvest;
          console.log('amount:', strategy.amount.toString(), 'creditAvailable:', creditAvailable.toString());
          if (creditAvailable.lt(strategy.amount)) continue;
        }

        const workable = await strategy.contract.harvestTrigger(1_000_000);
        console.log('workabe:', workable);

        const gasLimit = await provider.estimateGas(await v2Keeper.populateTransaction.harvest(strategy.address));
        console.log('gasLimit', gasLimit.toNumber());

        await v2Keeper.callStatic.harvest(strategy.address, {
          gasLimit: gasLimit.mul(11).div(10),
        });

        if (strategy.isCRV && harvestedCRV) {
          console.log('already harvested a CRV strat this cycle, skipping...');
          continue;
        }
        console.log('working...');

        // continue;

        const gasResponse = await taichi.getGasPrice();
        console.log('taichi gasPrices:', {
          fast: Math.floor(gasResponse.data.fast / 10 ** 9),
          standard: Math.floor(gasResponse.data.standard / 10 ** 9),
          slow: Math.floor(gasResponse.data.slow / 10 ** 9),
        });
        const gasPrice = ethers.BigNumber.from(gasResponse.data.fast);
        console.log('gasPrice in gwei:', gasPrice.div(gwei).toNumber());

        const maxGwei = 150;
        if (gasPrice.gt(gwei.mul(maxGwei))) {
          reject(`gas price > ${maxGwei}gwei`);
        }

        const nonce = ethers.BigNumber.from(await signer.getTransactionCount()).add(nonceIncreasedBy);
        console.log('using account nonce:', nonce.toNumber());
        nonceIncreasedBy = nonceIncreasedBy.add(1);

        const rawMessage = await v2Keeper.populateTransaction.harvest(strategy.address, {
          gasPrice,
          nonce,
          gasLimit: gasLimit.mul(11).div(10), // 10% buffer
        });
        console.log(rawMessage);

        const signedMessage = await signer.signTransaction(rawMessage);

        // if ((await sendTxPrompt.run()) == false) {
        //   console.log('not sending tx, bye :)');
        //   return resolve();
        // }
        const res = await taichi.sendPrivateTransaction(signedMessage);
        if (res.error) {
          if (res.error == 'already known') continue;
          return reject(res.error.message);
        }

        const privateTxHash = res.result;
        console.log({ privateTxHash });

        if (!privateTxHash) {
          return reject('no privateTxHash from taichi');
        }
        let received;
        while (!received) {
          await new Promise((r) => setTimeout(r, 2000)); // sleeps 2s
          const query = await taichi.queryPrivateTransaction(privateTxHash);
          received = query.success && query.obj.status == 'pending';
          if (received) {
            console.log('received tx:');
            console.log(query.obj);
          }
        }

        // TODO remove this
        return resolve(); // only allow 1 harvest every 10 minutes

        if (strategy.isCRV) harvestedCRV = true;
      }
      console.log('waiting 10 minutes...');
    } catch (err) {
      reject(`working v2 harvest strategies: ${err.message}`);
    }
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
