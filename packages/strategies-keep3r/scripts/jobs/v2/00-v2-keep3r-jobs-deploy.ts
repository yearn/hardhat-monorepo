import { ContractFactory } from 'ethers';
import { run, ethers, network } from 'hardhat';
import { e18, ZERO_ADDRESS } from '../../../utils/web3-utils';
import config from '../../../contracts.json';
const escrowContracts = config.contracts.mainnet.escrow;
const mechanicsContracts = config.contracts.mainnet.mechanics;
const genericV2Keep3rJobContracts = config.contracts.mainnet.genericV2Keep3rJob;

const { Confirm } = require('enquirer');
const prompt = new Confirm('Do you wish to deploy v2 keep3r jobs contracts?');

async function main() {
  await run('compile');
  const V2Keeper: ContractFactory = await ethers.getContractFactory('V2Keeper');
  const HarvestV2Keep3rJob: ContractFactory = await ethers.getContractFactory('HarvestV2Keep3rJob');
  const TendV2Keep3rJob: ContractFactory = await ethers.getContractFactory('TendV2Keep3rJob');
  await promptAndSubmit(V2Keeper, HarvestV2Keep3rJob, TendV2Keep3rJob);
}

function promptAndSubmit(
  V2Keeper: ContractFactory,
  HarvestV2Keep3rJob: ContractFactory,
  TendV2Keep3rJob: ContractFactory
): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    const [owner] = await ethers.getSigners();
    console.log('using address:', owner.address);
    prompt.run().then(async (answer: any) => {
      if (answer) {
        try {
          const v2Keeper = await ethers.getContractAt('V2Keeper', config.contracts.mainnet.proxyJobs.v2Keeper);
          // // deploy V2Keeper // already deployed
          // console.log('V2Keeper:', mechanicsContracts.registry);
          // const v2Keeper = await V2Keeper.deploy(mechanicsContracts.registry);
          // console.log('v2Keeper address:', v2Keeper.address);
          // console.log(
          //   'PLEASE: change .config.json & example.config.json proxyJobs.v2Keeper address to:',
          //   v2Keeper.address
          // );
          // console.log();

          console.log(
            'TendV2Keep3rJob:',
            mechanicsContracts.registry,
            config.contracts.mainnet.keep3r.address,
            ZERO_ADDRESS,
            e18.mul(50).toString(), // 50 KP3R required
            0,
            0,
            true,
            v2Keeper.address
          );
          const tendV2Keep3rJob = await TendV2Keep3rJob.deploy(
            mechanicsContracts.registry,
            config.contracts.mainnet.keep3r.address,
            ZERO_ADDRESS,
            e18.mul(50), // 50 KP3R required
            0,
            0,
            true,
            v2Keeper.address
          );
          console.log('TendV2Keep3rJob address:', tendV2Keep3rJob.address);
          console.log('PLEASE: change .config.json & example.config.json proxyJobs.tendV2Keep3rJob address to:', tendV2Keep3rJob.address);
          console.log();

          console.log(
            'HarvestV2Keep3rJob:',
            mechanicsContracts.registry, // address _mechanicsRegistry,
            config.contracts.mainnet.keep3r.address, // address _keep3r,
            ZERO_ADDRESS, // address _bond,
            e18.mul(50).toString(), // 50 KP3R required // uint256 _minBond,
            0, // uint256 _earned,
            0, // uint256 _age,
            true, // bool _onlyEOA,
            v2Keeper.address, // address _v2Keeper,
            6 * 60 * 60 // 6 hours // uint256 _workCooldown
          );
          const harvestV2Keep3rJob = await HarvestV2Keep3rJob.deploy(
            mechanicsContracts.registry,
            config.contracts.mainnet.keep3r.address,
            ZERO_ADDRESS,
            e18.mul(50), // 50 KP3R required
            0,
            0,
            true,
            v2Keeper.address,
            6 * 60 * 60 // 6 hours
          );
          console.log('HarvestV2Keep3rJob address:', harvestV2Keep3rJob.address);
          console.log('PLEASE: change .config.json & example.config.json proxyJobs.harvestV2Keep3rJob address to:', harvestV2Keep3rJob.address);
          resolve();
        } catch (err) {
          reject(`Error while deploying v2 keep3r job contracts: ${err.message}`);
        }
      } else {
        console.error('Aborted!');
        resolve();
      }
    });
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
