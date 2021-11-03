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
      const tendV2DetachedJob = await ethers.getContractAt('TendV2DetachedJob', contracts.tendV2DetachedJob[networkName]);
      const strategies = await tendV2DetachedJob.callStatic.strategies();
      console.log(`checking ${strategies.length} tendV2DetachedJob strategies`);
      for (const strategy of strategies) {
        try {
          const workable = await tendV2DetachedJob.callStatic.workable(strategy);
          if (!workable) continue;
          console.log('working:', strategy);
          await tendV2DetachedJob.callStatic.work(strategy);
          await tendV2DetachedJob.work(strategy);
          console.log('worked');
          return resolve();
        } catch (error) {
          console.log(error);
        }
      }
    } catch (err: any) {
      reject(`Error while working tend detached job: ${err.message}`);
    }

    try {
      const harvestCooldown = 10 * 60; // 10 minutes
      const harvestV2DetachedJob = await ethers.getContractAt('HarvestV2DetachedJob', contracts.harvestV2DetachedJob[networkName]);
      const strategies = await harvestV2DetachedJob.callStatic.strategies();
      console.log(`checking ${strategies.length} harvestV2DetachedJob strategies`);
      let lastWork;
      for (const strategy of strategies) {
        const lastWorkAt = await harvestV2DetachedJob.callStatic.lastWorkAt(strategy);
        if (!lastWork || lastWorkAt.gt(lastWork)) lastWork = lastWorkAt;
      }
      if (lastWork.toNumber() + harvestCooldown > Math.floor(new Date().valueOf() / 1000)) {
        console.log('harvest job on cooldown');
        return resolve();
      }

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
    } catch (err: any) {
      reject(`Error while working harvest detached job: ${err.message}`);
    }
    console.log('no work');
    return resolve();
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
