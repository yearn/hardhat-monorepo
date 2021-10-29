const axios = require('axios');
const hre = require('hardhat');
const ethers = hre.ethers;
const { gwei, e18, bnToDecimal } = require('../../utils/web3-utils');
const config = require('../../.config.json');
const mainnetContracts = config.contracts.mainnet;

const vaultAPIVersions = {
  default: 'contracts/interfaces/yearn/IVaultAPI.sol:VaultAPI',
  '0.3.0': 'contracts/interfaces/yearn/IVaultAPI.sol:VaultAPI',
  '0.3.2': 'contracts/interfaces/yearn/IVaultAPI_0_3_2.sol:VaultAPI',
};

async function main() {
  await hre.run('compile');
  await promptAndSubmit();
}

function promptAndSubmit() {
  return new Promise(async (resolve, reject) => {
    try {
      // Setup deployer
      const [owner] = await ethers.getSigners();
      let deployer;
      if (owner.address == config.accounts.mainnet.deployer) {
        deployer = owner;
      } else {
        await hre.network.provider.request({
          method: 'hardhat_impersonateAccount',
          params: [config.accounts.mainnet.deployer],
        });
        deployer = owner.provider.getUncheckedSigner(config.accounts.mainnet.deployer);
      }

      console.log('using vaults.finance/all API as registry');
      const response = await axios.get('https://vaults.finance/all');
      const vaults = response.data
        .filter((vault) => vault.type === 'v2')
        .map((vault) => ({
          address: vault.address,
          strategies: vault.strategies,
          decimals: vault.decimals,
          name: vault.name,
          endorsed: vault.endorsed,
          symbol: vault.symbol,
          token: {
            address: vault.token.address,
            name: vault.token.name,
            symbol: vault.token.symbol,
            decimals: vault.token.decimals,
          },
        }));
      const endorsedVaults = vaults.filter((vault) => vault.endorsed);
      console.log(endorsedVaults.length, 'endorsed v2 vaults');

      // HARDCODED v2 Strats
      const v2Strategies = [
        /*
        { address: '0x979843B8eEa56E0bEA971445200e0eC3398cdB87' },
        { address: '0x4D7d4485fD600c61d840ccbeC328BfD76A050F87' },
        { address: '0x4031afd3B0F71Bace9181E554A9E680Ee4AbE7dF' },
        { address: '0xeE697232DF2226c9fB3F02a57062c4208f287851' },
        { address: '0x32b8C26d0439e1959CEa6262CBabC12320b384c4' },
        { address: '0x2A94A56fBEE72ACEC39ea0269c1356a8DFbC4765' },
        { address: '0x4730D10703155Ef4a448B17b0eaf3468fD4fb02d' },
        { address: '0x5148C3124B42e73CA4e15EEd1B304DB59E0F2AF7' },
        { address: '0x77b7CD137Dd9d94e7056f78308D7F65D2Ce68910' },
        */
        { address: '0x0E5397B8547C128Ee20958286436b7BC3f9faAa4' },
        { address: '0x2886971eCAF2610236b4869f58cD42c115DFb47A' },
        { address: '0x91cBf0014a966615e1050c90A1aBf1d1d5d8cffd' },
        { address: '0xE68A8565B4F837BDa10e2e917BFAaa562e1cD143' },
        { address: '0x683b5C88D48FcCfB3e778FF0fA954F84cA7Ce9DF' },
        /*
        { address: '0x9f51F4df0b275dfB1F74f6Db86219bAe622B36ca' },
        { address: '0xdD498eB680B0CE6Cac17F7dab0C35Beb6E481a6d' },
        { address: '0xdD92491B9F55620C043d55D25620a7B126451ddD' },
        { address: '0xE73817de3418bB44A4FeCeBa53Aa835333C550e7' },
        { address: '0xda988eBb26F505246C59Ba26514340B634F9a7a2' },
        { address: '0x24579b82E06aBe25C8ffC4Ee6C2dB676e57F1a32' },
        { address: '0x04a6E58aAd4Ed8053Ba436B00C02A8a000639e93' },
        { address: '0xABCBB67Ef2757bCCff074014658d9BD13f559632' },
        { address: '0x92D03B12E5f67b0df3B50c7c01c141Bf4BD98eA6' },
        { address: '0x21e5a745d77430568C074569C06e6c765922626a' },
        { address: '0x2E1ad896D3082C52A5AE7Af307131DE7a37a46a0' },
        { address: '0x01b54c320d6B3057377cbc71d953d1BBa84df44e' },
        */
      ];

      // const v2Strategies = endorsedVaults
      //   .map((vault) => vault.strategies)
      //   .flat();

      const v2StrategiesBAG = [
        // bag
        // { address: '0x6107add73f80AC6015E85103D2f016C6373E4bDc' }, //weth
        // { address: '0xFc403fd9E7A916eC38437807704e92236cA1f7A5' }, //dai
        // { address: '0x063303D9584Ac9A67855086e16Ca7212C109b7b4' }, //usdc
        // { address: '0xF0252a99691D591A5A458b9b4931bF1025BF6Ac3' }, //wbtc
      ];

      const harvestV2Keep3rJob = await ethers.getContractAt('HarvestV2Keep3rJob', mainnetContracts.oldJobs.harvestV2Keep3rJob);
      const tendV2Keep3rJob = await ethers.getContractAt('TendV2Keep3rJob', mainnetContracts.jobs.tendV2Keep3rJob);

      for (const strategy of v2StrategiesBAG) {
        harvestV2Keep3rJob.connect(deployer).addStrategy(strategy.address, 1000000);
        v2Strategies.push(strategy);
      }

      for (const strategy of v2Strategies) {
        strategy.contract = await ethers.getContractAt('IBaseStrategy', strategy.address, deployer);

        // keep3r setup and contract overwrite
        strategy.keeper = await strategy.contract.callStatic.keeper();
        await hre.network.provider.request({
          method: 'hardhat_impersonateAccount',
          params: [strategy.keeper],
        });
        strategy.keeperAccount = owner.provider.getUncheckedSigner(strategy.keeper);
        strategy.contract = await ethers.getContractAt('IBaseStrategy', strategy.address, strategy.keeperAccount);
        (await ethers.getContractFactory('ForceETH')).deploy(strategy.keeper, {
          value: e18.mul(100),
        });

        strategy.vault = await strategy.contract.callStatic.vault();
        strategy.want = await strategy.contract.callStatic.want();
        strategy.name = await strategy.contract.callStatic.name();
        strategy.wantContract = await ethers.getContractAt('ERC20Mock', strategy.want, strategy.keeperAccount);
        strategy.wantSymbol = await strategy.wantContract.callStatic.symbol();
        strategy.wantBalancePre = await strategy.wantContract.callStatic.balanceOf(strategy.address);
        strategy.decimals = await strategy.wantContract.callStatic.decimals();
        // init default
        strategy.vaultContract = await ethers.getContractAt(vaultAPIVersions['default'], strategy.vault, strategy.keeperAccount);
        strategy.vaultAPIVersion = await strategy.vaultContract.apiVersion();
        strategy.vaultContract = await ethers.getContractAt(
          vaultAPIVersions[strategy.vaultAPIVersion] || vaultAPIVersions['0.3.2'],
          strategy.vault,
          strategy.keeperAccount
        );

        strategy.vaultTotalAssets = await strategy.vaultContract.callStatic.totalAssets();
      }

      for (const strategy of v2Strategies) {
        console.log('strategy:', strategy.address);
        let harvestable;
        let tendable;
        try {
          harvestable = await harvestV2Keep3rJob.callStatic.workable(strategy.address);
          tendable = await tendV2Keep3rJob.callStatic.workable(strategy.address);
        } catch (error) {
          if (error.message.indexOf('V2Keep3rJob::workable:strategy-not-added') == -1) {
            console.log(error.message);
          }
        }

        strategy.harvestable = harvestable;
        strategy.tendable = tendable;

        console.log('harvestable:', harvestable, 'tendable:', tendable);

        if (harvestable) console.log(`harvest with ${strategy.keeper} on: https://etherscan.io/address/${strategy.address}#writeContract`);
        if (tendable) console.log(`tend with ${strategy.keeper} on: https://etherscan.io/address/${strategy.address}#writeContract`);
        console.log();
      }

      for (const strategy of v2Strategies) {
        strategy.paramsPre = await getStrategyParams(strategy);
      }

      for (const strategy of v2Strategies) {
        await strategy.contract.harvest();
      }

      for (const strategy of v2Strategies) {
        const params = await strategy.vaultContract.callStatic.strategies(strategy.address);
        strategy.paramsPost = await getStrategyParams(strategy);
        strategy.wantBalancePost = await strategy.wantContract.callStatic.balanceOf(strategy.address);
      }

      for (const strategy of v2Strategies) {
        try {
          console.log('harvestable:', strategy.harvestable, 'tendable:', strategy.tendable);
          logData(strategy, strategy.paramsPre);
          logVaultData(strategy, strategy.paramsPre);
          logParams(strategy, strategy.paramsPre);
          logParams(strategy, strategy.paramsPost);
          logCompare(strategy, strategy.paramsPre, strategy.paramsPost);
          logVaultData(strategy, strategy.paramsPost);
        } catch (error) {
          console.log('### Error:');
          console.log(error);
          console.log();
          console.log();
        }
        console.log();
      }

      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

function logData(strategy, params) {
  console.log(
    strategy.wantSymbol,
    `strategy ${strategy.name}:`,
    strategy.address,
    'performanceFee:',
    params.performanceFee.toNumber(),
    'activation:',
    new Date(parseInt(params.activation.mul(1000).toString())).toUTCString(),
    'lastReport:',
    new Date(parseInt(params.lastReport.mul(1000).toString())).toUTCString()
  );
}

function logVaultData(strategy, params) {
  console.log(
    'vault:',
    strategy.vault,
    'vaultTotalAssets:',
    bnToDecimal(strategy.vaultTotalAssets, strategy.decimals),
    'debtRatio:',
    params.debtRatio.toNumber(),
    'availableDebt:',
    bnToDecimal(
      strategy.vaultTotalAssets
        .sub(params.totalDebt)
        .mul(10_000)
        .div(params.debtRatio.eq(0) ? 10_000 : params.debtRatio),
      strategy.decimals
    )
  );
}
function logParams(strategy, params) {
  if (strategy.vaultAPIVersion === '0.3.2') {
    console.log(
      'minDebtPerHarvest:',
      bnToDecimal(params.minDebtPerHarvest, strategy.decimals),
      'maxDebtPerHarvest:',
      params.maxDebtPerHarvest.gt(e18.mul(e18)) ? 'infinity' : bnToDecimal(params.maxDebtPerHarvest, strategy.decimals),
      'totalDebt:',
      bnToDecimal(params.totalDebt, strategy.decimals),
      'totalGain:',
      bnToDecimal(params.totalGain, strategy.decimals),
      'totalLoss:',
      bnToDecimal(params.totalLoss, strategy.decimals)
    );
  } else {
    console.log(
      'rateLimit:',
      bnToDecimal(params.rateLimit, strategy.decimals),
      'totalDebt:',
      bnToDecimal(params.totalDebt, strategy.decimals),
      'totalGain:',
      bnToDecimal(params.totalGain, strategy.decimals),
      'totalLoss:',
      bnToDecimal(params.totalLoss, strategy.decimals)
    );
  }
}
function logCompare(strategy, paramsPre, paramsPost) {
  const params = ['totalDebt', 'totalGain', 'totalLoss'];
  let paramsCompare = '';
  for (const param of params) {
    if (Object.keys(paramsPre).indexOf(param) == -1) continue;
    paramsCompare += param + ': ' + bnToDecimal(paramsPost[param].sub(paramsPre[param]), strategy.decimals) + ' ';
  }
  paramsCompare += 'wantBalance: ' + bnToDecimal(strategy.wantBalancePost.sub(strategy.wantBalancePre), strategy.decimals);
  console.log(paramsCompare);
}

async function getStrategyParams(strategy) {
  const params = await strategy.vaultContract.callStatic.strategies(strategy.address);
  if (strategy.vaultAPIVersion === '0.3.2')
    return {
      performanceFee: params.performanceFee,
      activation: params.activation,
      debtRatio: params.debtRatio,
      minDebtPerHarvest: params.minDebtPerHarvest,
      maxDebtPerHarvest: params.maxDebtPerHarvest,
      lastReport: params.lastReport,
      totalDebt: params.totalDebt,
      totalGain: params.totalGain,
      totalLoss: params.totalLoss,
    };
  return {
    performanceFee: params.performanceFee,
    activation: params.activation,
    debtRatio: params.debtRatio,
    rateLimit: params.rateLimit,
    lastReport: params.lastReport,
    totalDebt: params.totalDebt,
    totalGain: params.totalGain,
    totalLoss: params.totalLoss,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
