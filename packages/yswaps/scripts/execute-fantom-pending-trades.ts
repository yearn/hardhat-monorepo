import { ethers, network } from 'hardhat';
import { BigNumber, PopulatedTransaction, utils, Wallet } from 'ethers';
import { TradeFactory } from '@typechained';
import sleep from 'sleep-promise';
import moment from 'moment';
import * as gasprice from './libraries/utils/ftm-gas-price';
import kms from '../../commons/tools/kms';
import { getNodeUrl } from '@utils/network';
import { JsonRpcProvider } from '@ethersproject/providers';
import * as evm from '@test-utils/evm';
import { getFantomSolversMap, fantomConfig } from '@scripts/configs/fantom';
import { Solver } from './libraries/types';

const DELAY = moment.duration('8', 'minutes').as('milliseconds');
const RETRIES = 10;
const MAX_GAS_PRICE = utils.parseUnits('1500', 'gwei');

// Provider
let fantomProvider: JsonRpcProvider;

async function main() {
  await gasprice.start();

  console.log('[Setup] Getting solvers map');
  const fantomSolversMap = await getFantomSolversMap();

  console.log('[Setup] Forking fantom');

  // We set this so hardhat-deploys uses the correct deployment addresses.
  process.env.HARDHAT_DEPLOY_FORK = 'fantom';
  await evm.reset({
    jsonRpcUrl: getNodeUrl('fantom'),
  });

  const ymech = new ethers.Wallet(await kms.decrypt(process.env.FANTOM_1_PRIVATE_KEY as string), ethers.provider);
  await ethers.provider.send('hardhat_setBalance', [ymech.address, '0xffffffffffffffff']);
  console.log('[Setup] Executing with address', ymech.address);

  // We create a provider thats connected to a real network, hardhat provider will be connected to fork
  // fantomProvider = new ethers.providers.JsonRpcProvider(getNodeUrl('fantom'), 250);
  fantomProvider = new ethers.providers.JsonRpcProvider('https://holy-still-dawn.fantom.quiknode.pro/cb7dce90a9949069a52a87631ec5de798b211221/');
  // fantomProvider = new ethers.providers.JsonRpcProvider('https://rpc.ftm.tools/');

  const tradeFactory: TradeFactory = await ethers.getContract('TradeFactory', ymech);

  let nonce = await ethers.provider.getTransactionCount(ymech.address);

  console.log('[Execution] Taking snapshot of fork');

  const snapshotId = (await network.provider.request({
    method: 'evm_snapshot',
    params: [],
  })) as string;

  console.log('------------');
  for (const strategy in fantomConfig) {
    const tradesConfig = fantomConfig[strategy];
    console.log('[Execution] Processing trade of strategy', tradesConfig.name);
    for (const tradeConfig of tradesConfig.tradesConfigurations) {
      console.log('[Execution] Processing', tradeConfig.enabledTrades.length, 'enabled trades with solver', tradeConfig.solver);

      const solver = fantomSolversMap[tradeConfig.solver] as Solver;
      const shouldExecute = await solver.shouldExecuteTrade({ strategy, trades: tradeConfig.enabledTrades });

      if (shouldExecute) {
        console.log('[Execution] Should execute');

        const executeTx = await solver.solve({
          strategy,
          trades: tradeConfig.enabledTrades,
          tradeFactory,
        });

        console.log('[Execution] Reverting to snapshot');

        await network.provider.request({
          method: 'evm_revert',
          params: [snapshotId],
        });

        console.log('[Execution] Executing trade in fork');
        console.log('[Debug] Tx data', executeTx.data!);

        try {
          const simulatedTx = await ymech.sendTransaction(executeTx);
          const confirmedTx = await simulatedTx.wait();
          console.log('[Execution] Simulation in fork succeeded used', confirmedTx.gasUsed.toString(), 'gas');
        } catch (error: any) {
          console.error('[Execution] Simulation in fork reverted');
          console.error(error);
          continue;
        }

        await network.provider.request({
          method: 'evm_revert',
          params: [snapshotId],
        });

        const gasParams = {
          gasPrice: utils.parseUnits(`${gasprice.get()}`, 'gwei'),
          gasLimit: 1_000_000,
        };

        const signedTx = await ymech.signTransaction({
          ...gasParams,
          to: executeTx.to!,
          data: executeTx.data!,
          chainId: 250,
          nonce: nonce,
        });

        // const tx = await fantomProvider.sendTransaction(signedTx);

        // console.log(`[Execution] Transaction set, check at https://ftmscan.com/tx/${tx.hash}`);

        // try {
        //   await tx.wait(20);
        //   console.log('[Execution] Transaction confirmed');
        // } catch (err) {
        //   console.error('[Execution] Transaction reverted');
        // }
        nonce++;
      } else {
        console.log('[Execution] Should not execute');
      }
      console.log('************');
    }
    console.log('------------');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
