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

    const strategiesToAlwaysHarvest: string[] = [
      '0xff3AeA00d3d58ba1a3672c766cc5060FfCb8cca3',
      '0xAB1d2ABbe31FA5945BfA0864f29dadDcB9cd9eAc',
      '0x399ee38023a914e953ab02ba164ddf941fe39bb9',
      '0xca25d703cd814e8f5cef9aacee0e7424bb4bccc6',
      '0x9d32f2bfc5dda3e82f364bf2f8a30d73247a01d1',
      '0x20b5e014f7251dfee5e51b5d2d627dfa5ff73824',
    ];

    try {
      const harvestCooldown = 10 * 60; // 10 minutes
      const harvestV2DetachedJob = await ethers.getContractAt('HarvestV2DetachedJob', contracts.harvestV2DetachedJob[networkName]);
      let strategies = await harvestV2DetachedJob.callStatic.strategies();
      strategies = strategies.filter((strategy: string) => strategiesToAlwaysHarvest.indexOf(strategy) == -1);

      console.log(`checking ${strategies.length} harvestV2DetachedJob strategies`);
      let lastWork;
      for (const strategy of strategies) {
        const lastWorkAt = await harvestV2DetachedJob.callStatic.lastWorkAt(strategy);
        if (!lastWork || lastWorkAt.gt(lastWork)) lastWork = lastWorkAt;
      }
      if (lastWork.toNumber() + harvestCooldown > Math.floor(new Date().valueOf() / 1000)) {
        console.log('harvest job on cooldown');
      } else {
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
      }
    } catch (err: any) {
      reject(`Error while working harvest detached job: ${err.message}`);
    }

    try {
      const harvestV2DetachedJob = await ethers.getContractAt('HarvestV2DetachedJob', contracts.harvestV2DetachedJob[networkName]);
      console.log(`checking ${strategiesToAlwaysHarvest.length} harvestV2DetachedJob forced strategies`);

      for (const strategy of strategiesToAlwaysHarvest) {
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
      reject(`Error while force working harvest detached job: ${err.message}`);
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
