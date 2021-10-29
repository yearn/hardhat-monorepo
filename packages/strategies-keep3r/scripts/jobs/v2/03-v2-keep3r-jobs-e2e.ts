import { ContractFactory } from 'ethers';
import { run, ethers } from 'hardhat';
import { e18 } from '../../../utils/web3-utils';
import config from '../../../contracts.json';
const escrowContracts = config.contracts.mainnet.escrow;
const mechanicsContracts = config.contracts.mainnet.mechanics;
const genericV2Keep3rJobContracts = config.contracts.mainnet.genericV2Keep3rJob;

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
    console.log('e2e test for V2 Keeper jobs');

    try {
      // deploy V2Keeper
      const v2Keeper = await V2Keeper.deploy(mechanicsContracts.registry);

      // deploy TendV2Keep3rJob
      const tendV2Keep3rJob = await TendV2Keep3rJob.deploy(
        mechanicsContracts.registry,
        escrowContracts.proxyJob,
        v2Keeper.address,
        escrowContracts.keep3r,
        genericV2Keep3rJobContracts.keep3rHelper,
        genericV2Keep3rJobContracts.slidingOracle
      );

      // deploy HarvestV2Keep3rJob
      const harvestV2Keep3rJob = await HarvestV2Keep3rJob.deploy(
        mechanicsContracts.registry,
        escrowContracts.proxyJob,
        v2Keeper.address,
        escrowContracts.keep3r,
        genericV2Keep3rJobContracts.keep3rHelper,
        genericV2Keep3rJobContracts.slidingOracle,
        6 * 60 * 60 // 6 hours
      );

      // Add harvest strategies
      const defaultHarvestAmount = 2_000_000; // 2m gas (no extra decimals)
      const v2Strategies = [
        {
          address: '0x979843B8eEa56E0bEA971445200e0eC3398cdB87',
          harvestAmount: defaultHarvestAmount,
        },
        { address: '0x4D7d4485fD600c61d840ccbeC328BfD76A050F87' },
        { address: '0x4031afd3B0F71Bace9181E554A9E680Ee4AbE7dF' },
        { address: '0xeE697232DF2226c9fB3F02a57062c4208f287851' },
        { address: '0x32b8C26d0439e1959CEa6262CBabC12320b384c4' },
      ];
      await harvestV2Keep3rJob.addStrategies(
        v2Strategies.map((v2Strategies) => v2Strategies.address),
        v2Strategies.map((v2Strategies) => v2Strategies.harvestAmount || defaultHarvestAmount)
      );

      for (const strategy of v2Strategies) {
        const workable = await harvestV2Keep3rJob.workableStrategy(strategy.address);
        console.log(strategy.address, 'workable:', workable);
      }

      // TODO add work test

      resolve();
    } catch (err) {
      reject(`Error on e2e for V2 Keep3r jobs: ${err.message}`);
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
