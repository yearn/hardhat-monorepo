const { Confirm } = require('enquirer');
const hre = require('hardhat');
const ethers = hre.ethers;
const config = require('../../.config.json');
const mainnetContracts = config.contracts.mainnet;

const { e18, ZERO_ADDRESS } = require('../../utils/web3-utils');

const prompt = new Confirm({
  message: 'Do you wish to deploy OracleBondedKeeper contract?',
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
          console.time('OracleBondedKeeper deployed');
          // Setup OracleBondedKeeper
          console.log(mainnetContracts.keep3r.address, mainnetContracts.keep3rV1Oracle.address);
          const OracleBondedKeeper = await ethers.getContractFactory('OracleBondedKeeper');
          const oracleBondedKeeper = await OracleBondedKeeper.deploy(mainnetContracts.keep3r.address, mainnetContracts.keep3rV1Oracle.address, {
            nonce: 886,
          });

          console.timeEnd('OracleBondedKeeper deployed');
          console.log('OracleBondedKeeper address:', oracleBondedKeeper.address);
          console.log('PLEASE: change .config.json & example.config.json oracle.oracleBondedKeeper address to:', oracleBondedKeeper.address);
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
