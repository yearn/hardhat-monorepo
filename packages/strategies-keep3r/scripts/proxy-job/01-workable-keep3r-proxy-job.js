const { Confirm } = require('enquirer');
const hre = require('hardhat');
const ethers = hre.ethers;
const config = require('../../.config.json');
const escrowContracts = config.contracts.mainnet.escrow;

async function main() {
  await hre.run('compile');

  await run();
}

function run() {
  return new Promise(async (resolve, reject) => {
    console.log('checking workable jobs on Keep3rProxyJob contract');
    try {
      const [owner] = await ethers.getSigners();
      // impersonate keeper
      await hre.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [config.accounts.mainnet.keeper],
      });
      const keeper = owner.provider.getUncheckedSigner(config.accounts.mainnet.keeper);

      // Setup Keep3rProxyJob
      const keep3rProxyJob = await ethers.getContractAt('Keep3rProxyJob', escrowContracts.proxyJob);
      // Important! use callStatic for all methods (even work) to avoid spending gas
      // only send work transaction if callStatic.work succedded,
      // even if workable is true, the job might not have credits to pay and the work tx will revert
      const jobs = await keep3rProxyJob.callStatic.jobs();
      for (const job of jobs) {
        console.time('check workable:', job);
        const workable = await keep3rProxyJob.callStatic.workable(job);
        console.timeEnd('check workable:', job);

        const jobContract = await ethers.getContractAt('IKeep3rJob', job);

        console.time('check workData:', job);
        const workData = await jobContract.callStatic.getWorkData();
        console.timeEnd('check workData:', job);

        console.log({ job, workable, workData });
        if (!workable) continue;
        try {
          await keep3rProxyJob.connect(keeper).callStatic.work(job, workData);
          await keep3rProxyJob.connect(keeper).work(job, workData);
          console.log('worked!');
          console.log('workable', await keep3rProxyJob.callStatic.workable(job));
        } catch (error) {
          console.log('workable error:', error.message);
        }
      }
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
