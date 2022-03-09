import { ethers, network } from 'hardhat';
import { BigNumber, PopulatedTransaction, utils, Wallet } from 'ethers';
import { TradeFactory } from '@typechained';
import sleep from 'sleep-promise';
import moment from 'moment';
import * as gasprice from './libraries/utils/gasprice';
import {
  FlashbotsBundleProvider,
  FlashbotsBundleRawTransaction,
  FlashbotsBundleResolution,
  FlashbotsBundleTransaction,
  FlashbotsTransaction,
  FlashbotsTransactionResponse,
  RelayResponseError,
  SimulationResponseSuccess,
  TransactionSimulationRevert,
} from '@flashbots/ethers-provider-bundle';
import kms from '../../commons/tools/kms';
import { getNodeUrl, SUPPORTED_NETWORKS } from '@utils/network';
import { JsonRpcProvider } from '@ethersproject/providers';
import * as evm from '@test-utils/evm';
import { abi as BlockProtectionABI } from './abis/BlockProtection';
import { getMainnetSolversMap, mainnetConfig } from '@scripts/configs/mainnet';
import { Solver } from './libraries/types';

const DELAY = moment.duration('8', 'minutes').as('milliseconds');
const RETRIES = 10;
const MAX_GAS_PRICE = utils.parseUnits('300', 'gwei');
const FLASHBOT_MAX_PRIORITY_FEE_PER_GAS = 3;

// Flashbot
let flashbotsProvider: FlashbotsBundleProvider;
type FlashbotBundle = Array<FlashbotsBundleTransaction | FlashbotsBundleRawTransaction>;

// Provider
let mainnetProvider: JsonRpcProvider;

async function main() {
  await gasprice.start();

  console.log('[Setup] Forking mainnet');

  // We set this so hardhat-deploys uses the correct deployment addresses.
  const networkName: SUPPORTED_NETWORKS = 'mainnet';
  process.env.HARDHAT_DEPLOY_FORK = networkName;
  await evm.reset({
    jsonRpcUrl: getNodeUrl(networkName),
  });

  const ymech = new ethers.Wallet(await kms.decrypt(process.env.MAINNET_1_PRIVATE_KEY as string), ethers.provider);
  await ethers.provider.send('hardhat_setBalance', [ymech.address, '0xffffffffffffffff']);
  console.log('[Setup] Executing with address', ymech.address);

  console.log('[Setup] Getting solvers map');
  const mainnetSolversMap = await getMainnetSolversMap();

  // We create a provider thats connected to a real network, hardhat provider will be connected to fork
  mainnetProvider = new ethers.providers.JsonRpcProvider(getNodeUrl('mainnet'), { name: 'mainnet', chainId: 1 });

  // console.log('[Setup] Creating flashbots provider ...');
  flashbotsProvider = await FlashbotsBundleProvider.create(
    mainnetProvider, // a normal ethers.js provider, to perform gas estimiations and nonce lookups
    ymech // ethers.js signer wallet, only for signing request payloads, not transactions
  );

  const tradeFactory: TradeFactory = await ethers.getContract('TradeFactory', ymech);

  const currentGas = gasprice.get(gasprice.Confidence.Highest);
  const gasPriceParams = {
    maxFeePerGas: MAX_GAS_PRICE,
    maxPriorityFeePerGas:
      currentGas.maxPriorityFeePerGas > FLASHBOT_MAX_PRIORITY_FEE_PER_GAS
        ? utils.parseUnits(`${currentGas.maxPriorityFeePerGas}`, 'gwei')
        : utils.parseUnits(`${FLASHBOT_MAX_PRIORITY_FEE_PER_GAS}`, 'gwei'),
  };

  let nonce = await ethers.provider.getTransactionCount(ymech.address);

  console.log('------------');
  for (const strategy in mainnetConfig) {
    const tradesConfig = mainnetConfig[strategy];
    console.log('[Execution] Processing trade of strategy', tradesConfig.name);
    for (const tradeConfig of tradesConfig.tradesConfigurations) {
      console.log('[Execution] Processing', tradeConfig.enabledTrades.length, 'enabled trades with solver', tradeConfig.solver);

      const solver = mainnetSolversMap[tradeConfig.solver];
      const shouldExecute = await solver.shouldExecuteTrade({ strategy, trades: tradeConfig.enabledTrades });

      if (shouldExecute) {
        console.log('[Execution] Should execute');

        console.time('[Execution] Total trade execution time in fork');

        console.log('[Execution] Setting fork up to speed with mainnet');
        await evm.reset({
          jsonRpcUrl: getNodeUrl('mainnet'),
        });

        console.log('[Execution] Taking snapshot of fork');
        const snapshotId = (await network.provider.request({
          method: 'evm_snapshot',
          params: [],
        })) as string;

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

        const blockProtection = await ethers.getContractAt(BlockProtectionABI, '0xCC268041259904bB6ae2c84F9Db2D976BCEB43E5', ymech);

        console.timeEnd('[Execution] Total trade execution time in fork');

        await generateAndSendBundle({
          blockProtection,
          wallet: ymech,
          executeTx,
          gasParams: {
            ...gasPriceParams,
            // gasLimit: confirmedTx.gasUsed.add(confirmedTx.gasUsed.div(5)),
            gasLimit: BigNumber.from(2_000_000),
          },
          nonce,
        });
      } else {
        console.log('[Execution] Should not execute');
      }
      console.log('************');
    }
    console.log('------------');
  }
}

async function generateAndSendBundle(params: {
  blockProtection: any;
  wallet: Wallet;
  executeTx: PopulatedTransaction;
  gasParams: {
    maxFeePerGas: BigNumber;
    maxPriorityFeePerGas: BigNumber;
    gasLimit: BigNumber;
  };
  nonce: number;
  retryNumber?: number;
}): Promise<boolean> {
  if (!params.retryNumber) params.retryNumber = 0;

  const targetBlockNumber = (await mainnetProvider.getBlockNumber()) + 3;

  const populatedTx = await params.blockProtection.populateTransaction.callWithBlockProtection(
    params.executeTx.to, // address _to,
    params.executeTx.data, // bytes memory _data,
    targetBlockNumber // uint256 _blockNumber
  );

  const signedTx = await params.wallet.connect(mainnetProvider).signTransaction({
    ...params.gasParams,
    type: 2,
    to: populatedTx.to!,
    data: populatedTx.data!,
    chainId: 1,
    nonce: params.nonce,
  });

  console.log('[Execution] Fee per gas', utils.formatUnits(params.gasParams.maxFeePerGas, 'gwei'), 'gwei');
  console.log('[Execution] Fee priority fee gas', utils.formatUnits(params.gasParams.maxPriorityFeePerGas, 'gwei'), 'gwei');
  console.log('[Execution] Gas limit', params.gasParams.gasLimit.toString());

  console.log('[Execution] Sending transaction in block', targetBlockNumber);

  const bundle: FlashbotBundle = [
    {
      signedTransaction: signedTx,
    },
  ];

  if (await submitBundleForBlock(bundle, targetBlockNumber)) {
    console.log('[Execution] Submitted');
    return true;
  }
  params.retryNumber++;
  if (params.retryNumber! >= RETRIES) {
    console.log('[Execution] Failed after', RETRIES, 'retries');
    return false;
  } else {
    return await generateAndSendBundle(params);
  }
}

async function submitBundleForBlock(bundle: FlashbotBundle, targetBlockNumber: number): Promise<boolean> {
  if (!(await simulateBundle(bundle, targetBlockNumber))) return false;
  const flashbotsTransactionResponse: FlashbotsTransaction = await flashbotsProvider.sendBundle(bundle, targetBlockNumber);
  const resolution = await (flashbotsTransactionResponse as FlashbotsTransactionResponse).wait();
  if (resolution == FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
    console.log('[Flashbot] BlockPassedWithoutInclusion, re-build and re-send bundle');
    return false;
  } else if (resolution == FlashbotsBundleResolution.AccountNonceTooHigh) {
    console.log('[Flashbot] AccountNonceTooHigh, adjust nonce');
    return false;
  }
  console.log('[Flashbot] BundleIncluded, sucess!');
  return true;
}

async function simulateBundle(bundle: FlashbotBundle, blockNumber: number): Promise<boolean> {
  const signedBundle = await flashbotsProvider.signBundle(bundle);
  try {
    const simulationResponse = await flashbotsProvider.simulate(signedBundle, blockNumber);
    if ((simulationResponse as RelayResponseError).error) {
      console.error(`[Flashbot] Simulation error: ${(simulationResponse as RelayResponseError).error.message}`);
    } else {
      const resultsFromSimulation = (simulationResponse as SimulationResponseSuccess).results;
      for (let i = 0; i < resultsFromSimulation.length; i++) {
        if ((resultsFromSimulation[i] as TransactionSimulationRevert).error) {
          console.log(
            '[Flashbot] Simulation error:',
            (resultsFromSimulation[i] as TransactionSimulationRevert).error,
            'in transaction',
            i,
            'in bundle'
          );
          return false;
        }
      }
    }
  } catch (error: any) {
    console.error('[Flashbot] Simulation error:', error.message);
    return false;
  }
  console.log('[Flashbot] Simulation success !');
  return true;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
