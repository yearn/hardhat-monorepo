import { run, ethers, network } from 'hardhat';
import * as contracts from '../../../utils/contracts';

async function main() {
  await run('compile');
  await promptAndSubmit();
}

function promptAndSubmit(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    const [, tender] = await ethers.getSigners();
    const networkName = 'fantom';
    let worked = [];
    let notWorkable = [];
    let errorWhileWorked = [];
    console.log('Using address:', tender.address, 'on fantom');
    try {
      const tendV2DetachedJob = await ethers.getContractAt('TendV2DetachedJob', contracts.tendV2DetachedJob[networkName], tender);
      const strategies = await tendV2DetachedJob.callStatic.strategies();
      for (const strategy of strategies) {
        console.log('Checking strategy', strategy);
        try {
          const workable = await tendV2DetachedJob.callStatic.workable(strategy);
          if (!workable) {
            console.log('Not workable');
            console.log('***************************');
            notWorkable.push(strategy);
            continue;
          }
          console.log('Working...');
          const gasLimit = await tendV2DetachedJob.estimateGas.work(strategy);
          const tx = await tendV2DetachedJob.work(strategy, { gasLimit: gasLimit.mul(110).div(100) });
          worked.push(strategy);
          console.log(`Check work tx at https://ftmscan.com/tx/${tx.hash}`);
        } catch (error: any) {
          console.log('Error while working:', error.message);
          errorWhileWorked.push(strategy);
        }
        console.log('***************************');
      }
      console.log('Not workable strategies:', notWorkable.join(','));
      console.log('***************************');
      console.log('Worked strategies:', worked.join(','));
      console.log('***************************');
      console.log('Errored while working:', errorWhileWorked.join(','));
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
