const { Confirm } = require('enquirer');
const hre = require('hardhat');
const ethers = hre.ethers;
const config = require('../../.config.json');
const { e18, ZERO_ADDRESS } = require('../../utils/web3-utils');

const prompt = new Confirm({
  message: 'Do you wish to deploy MechanicsRegistry contract?',
});

async function main() {
  await hre.run('compile');
  const MechanicsRegistry = await ethers.getContractFactory('MechanicsRegistry');

  await promptAndSubmit(MechanicsRegistry);
}

function promptAndSubmit(MechanicsRegistry) {
  return new Promise(async (resolve) => {
    const [owner] = await ethers.getSigners();
    console.log('using address:', owner.address);
    try {
      prompt.run().then(async (answer) => {
        if (answer) {
          console.time('MechanicsRegistry deployed');
          // Setup MechanicsRegistry
          const mechanicsRegistry = await MechanicsRegistry.deploy(owner.address);
          console.timeEnd('MechanicsRegistry deployed');
          console.log('MechanicsRegistry address:', mechanicsRegistry.address);
          console.log('PLEASE: change .config.json & example.config.json mechanics.registry address to:', mechanicsRegistry.address);
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
