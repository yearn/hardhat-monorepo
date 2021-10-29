const { Confirm } = require('enquirer');
const hre = require('hardhat');
const ethers = hre.ethers;
const config = require('../../.config.json');
const mainnetContracts = config.contracts.mainnet;

const { e18, ZERO_ADDRESS } = require('../../utils/web3-utils');

const prompt = new Confirm({
  message: 'Do you wish to deploy PartialKeep3rV1OracleJob contract?',
});

async function main() {
  await hre.run('compile');
  await promptAndSubmit();
}

function promptAndSubmit() {
  return new Promise(async (resolve) => {
    const [owner] = await ethers.getSigners();
    console.log('using address:', owner.address);
    try {
      prompt.run().then(async (answer) => {
        if (answer) {
          console.time('PartialKeep3rV1OracleJob deployed');
          // Setup PartialKeep3rV1OracleJob
          console.log(
            mainnetContracts.keep3r.address,
            ZERO_ADDRESS,
            e18.mul(200).toString(), // 200 KP3R required
            0,
            0,
            false, // only EOA disabled
            mainnetContracts.oracle.oracleBondedKeeper
          );
          const PartialKeep3rV1OracleJob = await ethers.getContractFactory('PartialKeep3rV1OracleJob');
          const partialKeep3rV1OracleJob = await PartialKeep3rV1OracleJob.deploy(
            mainnetContracts.keep3r.address,
            ZERO_ADDRESS,
            e18.mul(200), // 200 KP3R required
            0,
            0,
            false, // only EOA disabled
            mainnetContracts.oracle.oracleBondedKeeper,
            { nonce: 887 }
          );
          console.timeEnd('PartialKeep3rV1OracleJob deployed');
          console.log('PartialKeep3rV1OracleJob address:', partialKeep3rV1OracleJob.address);
          console.log(
            'PLEASE: change .config.json & example.config.json oracle.partialKeep3rV1OracleJob address to:',
            partialKeep3rV1OracleJob.address
          );
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
