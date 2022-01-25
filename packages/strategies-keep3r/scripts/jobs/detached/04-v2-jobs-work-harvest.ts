import * as evm from '@test-utils/evm';
import { getNodeUrl } from '@utils/network';
import { run, ethers, network } from 'hardhat';
import * as contracts from '../../../utils/contracts';
import { harvestConfigurations } from '../../../utils/v2-ftm-strategies';

async function main() {
  await run('compile');
  await promptAndSubmit();
}

function promptAndSubmit(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    const [harvester] = await ethers.getSigners();
    const networkName = 'fantom';
    console.log('Using address:', harvester.address, 'on fantom');
    let worked = [];
    let notWorkable = [];
    let errorWhileWorked = [];
    const harvestV2DetachedJob = await ethers.getContractAt('HarvestV2DetachedJob', contracts.harvestV2DetachedJob[networkName]);
    const strategies = await harvestV2DetachedJob.callStatic.strategies();

    let lastTimeRewardWasDumped: { [address: string]: number } = {};
    for (const harvestConfiguration of harvestConfigurations) {
      const lastWorkAt = await harvestV2DetachedJob.callStatic.lastWorkAt(harvestConfiguration.address);
      if (
        !lastTimeRewardWasDumped.hasOwnProperty(harvestConfiguration.rewards!) ||
        lastWorkAt.gt(lastTimeRewardWasDumped[harvestConfiguration.rewards!])
      ) {
        lastTimeRewardWasDumped[harvestConfiguration.rewards!] = lastWorkAt;
      }
    }
    console.log(lastTimeRewardWasDumped);

    // for (const strategy of strategies) {
    //   console.log('Checking strategy', strategy);
    //   try {
    //     const workable = await harvestV2DetachedJob.callStatic.workable(strategy);
    //     if (!workable) {
    //       console.log('Not workable');
    //       notWorkable.push(strategy);
    //       continue;
    //     }
    //     console.log('Working...');
    //     const gasLimit = await harvestV2DetachedJob.estimateGas.work(strategy);
    //     const tx = await harvestV2DetachedJob.work(strategy, { gasLimit: gasLimit.mul(110).div(100) });
    //     worked.push(strategy);
    //     console.log(`Check work tx at https://ftmscan.com/tx/${tx.hash}`);
    //   } catch (error: any) {
    //     console.log('Error while working:', error.message);
    //     errorWhileWorked.push(strategy);
    //   }
    //   console.log('***************************');
    // }
    // console.log('Not workable strategies:', notWorkable.join(','));
    // console.log('***************************');
    // console.log('Worked strategies:', worked.join(','));
    // console.log('***************************');
    // console.log('Errored while working:', errorWhileWorked.join(','));
    // resolve();
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
