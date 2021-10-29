const { Confirm } = require('enquirer');
const hre = require('hardhat');
const ethers = hre.ethers;
const config = require('../../.config.json');
const { e18, ZERO_ADDRESS } = require('../../utils/web3-utils');

const prompt = new Confirm({
  message: 'Do you wish to deploy keep3r escrow contract?',
});

async function main() {
  await hre.run('compile');
  const Keep3rEscrow = await ethers.getContractFactory('contracts/keep3r/Keep3rEscrow.sol:Keep3rEscrow');

  await promptAndSubmit(Keep3rEscrow);
}

function promptAndSubmit(Keep3rEscrow) {
  return new Promise((resolve) => {
    try {
      prompt.run().then(async (answer) => {
        if (answer) {
          console.time('Keep3rEscrow deployed');
          const escrowContracts = config.contracts.mainnet.escrow;
          const keep3rEscrow = await Keep3rEscrow.deploy(escrowContracts.governance, escrowContracts.keep3r, escrowContracts.lpToken);
          console.timeEnd('Keep3rEscrow deployed');
          console.log('Keep3rEscrow address:', keep3rEscrow.address);
          console.log('PLEASE: change .config.json & example.config.json keep3rEscrow address to:', keep3rEscrow.address);
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
