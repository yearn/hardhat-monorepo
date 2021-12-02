import { run, ethers, network } from 'hardhat';
import { e18, ZERO_ADDRESS } from '../../../utils/web3-utils';
import * as contracts from '../../../utils/contracts';
import { v2StealthStrategies } from '../../../utils/v2-stealth-harvest-strategies';

const { Confirm } = require('enquirer');
const prompt = new Confirm({
  message: 'Do you wish to know which v2 stealth strategies are workable?',
});

async function main() {
  await run('compile');
  await promptAndSubmit();
}

function promptAndSubmit(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    const [owner] = await ethers.getSigners();
    console.log('using address:', owner.address);
    prompt.run().then(async (answer: any) => {
      if (answer) {
        try {
          const harvestV2Keep3rStealthJob = await ethers.getContractAt(
            'HarvestV2Keep3rStealthJob',
            contracts.harvestV2Keep3rStealthJob.mainnet as string
          );
          const strategies = await harvestV2Keep3rStealthJob.callStatic.strategies();

          // const strategies = [
          //   '0x564bf2844654f149821697cC56572eE4384c05f7',
          //   '0x1D371Ae86c8316917373Ec572B18776655Fd11b7',
          // ];
          console.log('strategies:', strategies);
          for (const strategy of strategies) {
            try {
              const strategyContract = await ethers.getContractAt('IBaseStrategy', strategy);
              try {
                const strategyKeeper = await strategyContract.keeper();
                if (strategyKeeper != contracts.v2Keeper.mainnet) {
                  console.log(strategy, 'keeper mismatch:', strategyKeeper);
                  continue;
                }
              } catch (error) {}
              const workableStrategy = await harvestV2Keep3rStealthJob.callStatic.workable(strategy);
              console.log(strategy, 'workable:', workableStrategy);
              if (!workableStrategy) continue;
              const worked = await harvestV2Keep3rStealthJob.callStatic.forceWorkUnsafe(strategy);
              console.log('worked:', worked);
            } catch (error) {
              console.log(strategy, 'error:');
              console.log(error);
            }
          }

          resolve();
        } catch (err) {
          reject(`Error while deploying v2 keep3r job contracts: ${(err as any).message}`);
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
