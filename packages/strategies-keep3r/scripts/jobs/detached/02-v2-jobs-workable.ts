import { run, ethers, network } from 'hardhat';
import * as contracts from '../../../utils/contracts';

const { Confirm } = require('enquirer');
const prompt = new Confirm({
  message: 'Do you wish to know which detached jobs are workable?',
});

async function main() {
  await run('compile');
  await promptAndSubmit();
}

function promptAndSubmit(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    const [owner] = await ethers.getSigners();
    const networkName = 'fantom';
    console.log('using address:', owner.address, 'on', networkName);
    prompt.run().then(async (answer: any) => {
      if (answer) {
        try {
          const tendV2DetachedJob = await ethers.getContractAt('TendV2DetachedJob', contracts.tendV2DetachedJob[networkName]);
          let strategies = await tendV2DetachedJob.callStatic.strategies();
          console.log('tendV2DetachedJob strategies:', strategies);
          for (const strategy of strategies) {
            try {
              const workable = await tendV2DetachedJob.callStatic.workable(strategy);
              console.log(strategy, 'workable:', workable);
            } catch (error) {
              console.log(strategy, 'workable error');
              // console.log(error);
            }
          }

          const harvestV2DetachedJob = await ethers.getContractAt('HarvestV2DetachedJob', contracts.harvestV2DetachedJob[networkName]);
          strategies = await harvestV2DetachedJob.callStatic.strategies();
          console.log('harvestV2DetachedJob strategies:', strategies);
          for (const strategy of strategies) {
            try {
              const workable = await harvestV2DetachedJob.workable(strategy);
              console.log(strategy, 'workable:', workable);
            } catch (error) {
              console.log(strategy, 'workable error');
              // console.log(error);
            }
          }

          resolve();
        } catch (err: any) {
          reject(`Error while checking detached jobs workable: ${err.message}`);
        }
      } else {
        console.error('Aborted!');
        resolve();
      }
    });
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
