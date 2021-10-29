const { Confirm } = require('enquirer');
const hre = require('hardhat');
const ethers = hre.ethers;
const config = require('../../.config.json');
const escrowContracts = config.contracts.mainnet.escrow;

const { e18, ZERO_ADDRESS } = require('../../utils/web3-utils');

const prompt = new Confirm({
  message: 'Do you wish to deploy Keep3rProxyJob contract?',
});

async function main() {
  await hre.run('compile');
  const Keep3rProxyJob = await ethers.getContractFactory('Keep3rProxyJob');

  await promptAndSubmit(Keep3rProxyJob);
}

function promptAndSubmit(Keep3rProxyJob) {
  return new Promise(async (resolve) => {
    const [owner] = await ethers.getSigners();
    console.log('using address:', owner.address);
    try {
      prompt.run().then(async (answer) => {
        if (answer) {
          console.time('Keep3rProxyJob deployed');
          // Setup Keep3rProxyJob
          console.log(
            escrowContracts.keep3r,
            ZERO_ADDRESS, // // KP3R bond
            e18.mul('50').toString(), // 50 KP3Rs bond requirement
            0,
            0,
            true
          );
          const keep3rProxyJob = await Keep3rProxyJob.deploy(
            escrowContracts.keep3r,
            ZERO_ADDRESS, // // KP3R bond
            e18.mul('50'), // 50 KP3Rs bond requirement
            0,
            0,
            true
          );
          console.timeEnd('Keep3rProxyJob deployed');
          console.log('Keep3rProxyJob address:', keep3rProxyJob.address);
          console.log('PLEASE: change .config.json & example.config.json proxyJob address to:', keep3rProxyJob.address);
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

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
