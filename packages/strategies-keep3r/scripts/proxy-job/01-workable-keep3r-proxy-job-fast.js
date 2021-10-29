const hre = require('hardhat');
const ethers = hre.ethers;
const config = require('../../.config.json');
const escrowContracts = config.contracts.mainnet.escrow;

const { e18, ZERO_ADDRESS } = require('../../utils/web3-utils');

async function main() {
  await hre.run('compile');

  await run();
}

function run() {
  return new Promise(async (resolve, reject) => {
    console.log('checking workable jobs on Keep3rProxyJob contract');
    try {
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

        const jobContract = await ethers.getContractAt('contracts/interfaces/proxy-job/IKeep3rJob.sol:IKeep3rJob', job);

        console.time('check workData:', job);
        const workData = await jobContract.callStatic.getWorkData();
        console.timeEnd('check workData:', job);

        console.log({ job, workable, workData });
      }
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
