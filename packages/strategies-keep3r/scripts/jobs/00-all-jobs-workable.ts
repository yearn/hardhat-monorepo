import { run, ethers } from 'hardhat';
import { JsonRpcSigner } from '@ethersproject/providers';
import config from '../../contracts.json';
const mainnetContracts = config.contracts.mainnet;

async function main() {
  await run('compile');
  await promptAndSubmit();
}

let keeper: JsonRpcSigner;

function promptAndSubmit(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    console.log('checking workable strategies on HarvestV2Keep3rJob contract');
    try {
      await v2Harvest();
      await crvHarvest();
      await vaultEarn();

      resolve();
    } catch (err) {
      reject(`Error while checking workable on all jobs: ${err.message}`);
    }
  });
}

async function v2Harvest() {
  // Setup HarvestV2Keep3rJob
  const HarvestV2Keep3rJob = await ethers.getContractAt('HarvestV2Keep3rJob', mainnetContracts.oldJobs.harvestV2Keep3rJob);
  console.log('HarvestV2Keep3rJob:', HarvestV2Keep3rJob.address);

  // New job: HarvestV2Keep3rJob https://etherscan.io/address/0x620bd1E1D1d845c8904aC03F6cd6b87706B7596b#code
  // Important! use callStatic for all methods (even workable and work) to avoid spending gas
  // only send work transaction if callStatic.work succeeded,
  // even if workable is true, the job might not have credits to pay and the work tx will revert
  const strategies = await HarvestV2Keep3rJob.callStatic.strategies();
  for (const strategy of strategies) {
    try {
      const workable = await HarvestV2Keep3rJob.callStatic.workable(strategy);
      console.log({ strategy, workable });
      if (!workable) continue;
      // await HarvestV2Keep3rJob.connect(keeper).callStatic.work(strategy);
      // await HarvestV2Keep3rJob.connect(keeper).work(strategy);
      // console.log('worked!');
    } catch (error) {
      console.log('error on HarvestV2Keep3rJob:', strategy);
      console.log(error.message);
    }
  }
}

async function crvHarvest() {
  const CrvStrategyKeep3rJob = await ethers.getContractAt('CrvStrategyKeep3rJob', mainnetContracts.jobs.crvStrategyKeep3rJob);
  console.log('CrvStrategyKeep3rJob:', CrvStrategyKeep3rJob.address);

  // New job: CrvStrategyKeep3rJob https://etherscan.io/address/0x02027bDA2425204f152B8aa35Fb78687D65E1AF5#code
  // Important! use callStatic for all methods (even work) to avoid spending gas
  // only send work transaction if callStatic.work succeeded,
  // even if workable is true, the job might not have credits to pay and the work tx will revert
  const strategies = await CrvStrategyKeep3rJob.callStatic.strategies();
  for (const strategy of strategies) {
    try {
      const workable = await CrvStrategyKeep3rJob.callStatic.workable(strategy);
      console.log({ strategy, workable });
      if (!workable) continue;
      // await CrvStrategyKeep3rJob.connect(keeper).callStatic.work(strategy);
      // await CrvStrategyKeep3rJob.connect(keeper).work(strategy);
      // console.log('worked!');
    } catch (error) {
      console.log('error on CrvStrategyKeep3rJob:', strategy);
      console.log(error.message);
    }
  }
}

async function vaultEarn() {
  const VaultKeep3rJob = await ethers.getContractAt('VaultKeep3rJob', mainnetContracts.jobs.vaultKeep3rJob);
  console.log('VaultKeep3rJob:', VaultKeep3rJob.address);

  // New job: VaultKeep3rJob https://etherscan.io/address/0x4a479E4457841D2D2Ff86e5A5389300963880C10#code
  // Important! use callStatic for all methods (even work) to avoid spending gas
  // only send work transaction if callStatic.work succeeded,
  // even if workable is true, the job might not have credits to pay and the work tx will revert
  const vaults = await VaultKeep3rJob.callStatic.vaults();
  for (const vault of vaults) {
    try {
      const workable = await VaultKeep3rJob.callStatic.workable(vault);
      console.log({ vault, workable });
      if (!workable) continue;
      // await VaultKeep3rJob.connect(keeper).callStatic.work(vault);
      // await VaultKeep3rJob.connect(keeper).work(vault);
      // console.log('worked!');
    } catch (error) {
      console.log('error on VaultKeep3rJob:', vault);
      console.log(error.message);
    }
  }
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
