const { Confirm } = require('enquirer');
const hre = require('hardhat');
const ethers = hre.ethers;
const config = require('../../.config.json');
const registryData = require('../../utils/v1-registry-data.json');
const { gwei, e18, bnToDecimal } = require('../../utils/web3-utils');

const prompt = new Confirm({
  message: 'Do you wish to work on v1 harvests contract?',
});

async function main() {
  await hre.run('compile');
  await promptAndSubmit();
}

function promptAndSubmit() {
  return new Promise((resolve, reject) => {
    try {
      prompt.run().then(async (answer) => {
        if (answer) {
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

          let vaults;
          if (registryData && registryData.length > 0) {
            console.log('using registryData');
            vaults = registryData;
          } else {
            console.log('using on-chain v1 registry');
            const v1registry = await ethers.getContractAt('IV1Registry', config.contracts.mainnet.v1registry.address);
            const vaultsAddresses = await v1registry.callStatic.getVaults();
            const vaultsInfo = await v1registry.callStatic.getVaultsInfo();
            vaults = vaultsAddresses.map((vaultAddress, i) => ({
              address: vaultAddress,
              controller: vaultsInfo.controllerArray[i],
              token: vaultsInfo.tokenArray[i],
              strategy: vaultsInfo.strategyArray[i],
              isWrapped: vaultsInfo.isWrappedArray[i],
              isDelegated: vaultsInfo.isDelegatedArray[i],
            }));
          }

          for (const vault of vaults) {
            vault.contract = await ethers.getContractAt('IV1Vault', vault.address);
            vault.strategyContract = await ethers.getContractAt('IV1Strategy', vault.strategy);
            vault.tokenContract = await ethers.getContractAt('ERC20Mock', vault.token);
            vault.decimals = await vault.tokenContract.callStatic.decimals();
            vault.name = await vault.contract.callStatic.name();
            vault.symbol = await vault.contract.callStatic.symbol();
            try {
              vault.keeper = await vault.strategyContract.callStatic.keeper();
            } catch (error) {}
            vault.want = await vault.strategyContract.callStatic.want();
            vault.wantContract = await ethers.getContractAt('ERC20Mock', vault.want);
            vault.wantSymbol = await vault.wantContract.callStatic.symbol();
          }

          // CRV Strats
          for (const vault of vaults) {
            try {
              vault.voter = await vault.strategyContract.callStatic.voter();
              vault.gauge = await vault.strategyContract.callStatic.gauge();
              vault.gaugeContract = await ethers.getContractAt('ICrvClaimable', vault.gauge);
              vault.claimableTokens = await vault.gaugeContract.callStatic.claimable_tokens(vault.voter);
              vault.checkHarvest = true;
              if (vault.claimableTokens > vault.decimals.mul(9_000)) {
                console.log();
                console.log(vault.name, vault.address, vault.strategy, 'want:', vault.wantSymbol);
                console.log('claimable:', bnToDecimal(vault.claimableTokens, vault.decimals), 'crv');
                console.log(`harvest with ${vault.keeper} on: https://etherscan.io/address/${vault.strategy}#writeContract`);
                console.log();
              }
            } catch (error) {}
          }

          for (const vault of vaults) {
            if (!vault.checkHarvest) {
              console.log(vault.strategy, vault.symbol, vault.wantSymbol, 'harvest not checked');
            }
          }

          resolve();
        } else {
          console.error('Aborted!');
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

function logData(strategy, params) {
  console.log(
    `strategy ${strategy.name}:`,
    strategy.address,
    'performanceFee:',
    params.performanceFee.toNumber(),
    'activation:',
    new Date(params.activation.toNumber()).toUTCString(),
    'lastReport:',
    new Date(params.lastReport.toNumber()).toUTCString()
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
    bnToDecimal(strategy.vaultTotalAssets.sub(params.totalDebt).mul(10_000).div(params.debtRatio), strategy.decimals)
  );
}
function logParams(strategy, params) {
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

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
