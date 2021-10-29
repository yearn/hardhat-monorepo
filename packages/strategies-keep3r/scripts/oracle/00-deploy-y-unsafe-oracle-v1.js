const { Confirm } = require('enquirer');
const hre = require('hardhat');
const ethers = hre.ethers;
const config = require('../../.config.json');
const mainnetContracts = config.contracts.mainnet;

const prompt = new Confirm({
  message: 'Do you wish to deploy YUnsafeOracleV1 contract?',
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
          console.time('YUnsafeOracleV1 deployed');
          // Setup Keep3rV2OracleFactoryWrapper and YUnsafeOracleV1
          console.log(mainnetContracts.oracle.yearnKeep3rV2OracleFactory);
          const Keep3rV2OracleFactoryWrapper = await ethers.getContractFactory('Keep3rV2OracleFactoryWrapper');
          const keep3rV2OracleFactoryWrapper = await Keep3rV2OracleFactoryWrapper.deploy(mainnetContracts.oracle.yearnKeep3rV2OracleFactory);
          const YUnsafeOracleV1 = await ethers.getContractFactory('YUnsafeOracleV1');
          const yUnsafeOracleV1 = await YUnsafeOracleV1.deploy(keep3rV2OracleFactoryWrapper.address);

          console.timeEnd('YUnsafeOracleV1 deployed');
          console.log('Keep3rV2OracleFactoryWrapper address:', keep3rV2OracleFactoryWrapper.address);
          console.log('YUnsafeOracleV1 address:', yUnsafeOracleV1.address);
          console.log(
            'PLEASE: change .config.json & example.config.json oracle.keep3rV2OracleFactoryWrapper address to:',
            keep3rV2OracleFactoryWrapper.address
          );
          console.log('PLEASE: change .config.json & example.config.json oracle.yUnsafeOracleV1 address to:', yUnsafeOracleV1.address);
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

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
