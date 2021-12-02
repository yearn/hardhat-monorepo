import { run, ethers, network } from 'hardhat';
import * as contracts from '../../../utils/contracts';

async function main() {
  await run('compile');
  await promptAndSubmit();
}

function promptAndSubmit(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    const [owner] = await ethers.getSigners();
    const networkName = 'ftm';
    console.log('using address:', owner.address, 'on', networkName);
    try {
      const harvestV2DetachedJob = await ethers.getContractAt('HarvestV2DetachedJob', contracts.harvestV2DetachedJob[networkName]);
      const strategies = await harvestV2DetachedJob.callStatic.strategies();
      console.log('harvestV2DetachedJob strategies:', strategies);
      for (const strategy of strategies) {
        try {
          const workable = await harvestV2DetachedJob.callStatic.workable(strategy);
          if (!workable) continue;
          console.log('working:', strategy);
          await harvestV2DetachedJob.callStatic.work(strategy);
          await harvestV2DetachedJob.work(strategy);
          console.log('worked');
          return resolve();
        } catch (error) {
          console.log(error);
        }
      }

      resolve();
    } catch (err: any) {
      reject(`Error while checking detached jobs workable: ${err.message}`);
    }
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
