import { ethers, network } from 'hardhat';
import { BigNumber, PopulatedTransaction, utils, Wallet } from 'ethers';
import { IERC20Metadata, ITradeFactoryPositionsHandler, TradeFactory } from '@typechained';
import sleep from 'sleep-promise';
import moment from 'moment';
import { abi as IERC20_ABI } from '@openzeppelin/contracts/build/contracts/IERC20Metadata.json';
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
import { TradeSetup, ExtendedEnabledTrade } from './libraries/types';
import { ThreePoolCrvMulticall } from '@scripts/libraries/solvers/multicall/ThreePoolCrvMulticall';
import { CurveSpellEthMulticall } from '@scripts/libraries/solvers/multicall/CurveSpellEthMulticall';
import kms from '../../commons/tools/kms';
import { getNodeUrl } from '@utils/network';
import { JsonRpcProvider } from '@ethersproject/providers';
import * as evm from '@test-utils/evm';
import { abi as BlockProtectionABI } from './abis/BlockProtection';

const DELAY = moment.duration('8', 'minutes').as('milliseconds');
const RETRIES = 10;
const MAX_GAS_PRICE = utils.parseUnits('300', 'gwei');
const FLASHBOT_MAX_PRIORITY_FEE_PER_GAS = 3;

// Flashbot
let flashbotsProvider: FlashbotsBundleProvider;
type FlashbotBundle = Array<FlashbotsBundleTransaction | FlashbotsBundleRawTransaction>;

// Provider
let mainnetProvider: JsonRpcProvider;

// Multicall swappers
const multicallSolvers = [new ThreePoolCrvMulticall(), new CurveSpellEthMulticall()];

async function main() {
  await gasprice.start();

  console.log('[Setup] Forking mainnet');

  // We set this so hardhat-deploys uses the correct deployment addresses.
  process.env.HARDHAT_DEPLOY_FORK = 'mainnet';
  await evm.reset({
    jsonRpcUrl: getNodeUrl('mainnet'),
  });

  const ymech = new ethers.Wallet(await kms.decrypt(process.env.MAINNET_1_PRIVATE_KEY as string), ethers.provider);
  await ethers.provider.send('hardhat_setBalance', [ymech.address, '0xffffffffffffffff']);
  console.log('[Setup] Executing with address', ymech.address);

  // We create a provider thats connected to a real network, hardhat provider will be connected to fork
  mainnetProvider = new ethers.providers.JsonRpcProvider(getNodeUrl('mainnet'), 'mainnet');

  // console.log('[Setup] Creating flashbots provider ...');
  flashbotsProvider = await FlashbotsBundleProvider.create(
    mainnetProvider, // a normal ethers.js provider, to perform gas estimiations and nonce lookups
    ymech // ethers.js signer wallet, only for signing request payloads, not transactions
  );

  const tradeFactory: TradeFactory = await ethers.getContract('TradeFactory', ymech);

  const enabledTrades: ITradeFactoryPositionsHandler.EnabledTradeStruct[] = await tradeFactory.enabledTrades();
  for (let i = 0; i < enabledTrades.length; i++) {
    console.log({
      strategy: enabledTrades[i]._strategy,
      tokenIn: await (await ethers.getContractAt<IERC20Metadata>(IERC20_ABI, enabledTrades[i]._tokenIn)).symbol(),
      tokenOut: await (await ethers.getContractAt<IERC20Metadata>(IERC20_ABI, enabledTrades[i]._tokenOut)).symbol(),
    });
  }

  let nonce = await ethers.provider.getTransactionCount(ymech.address);

  for (const enabledTrade of enabledTrades) {
    const tokenIn = await ethers.getContractAt<IERC20Metadata>(IERC20_ABI, enabledTrade._tokenIn);
    const symbolIn = await tokenIn.symbol();
    const tokenOut = await ethers.getContractAt<IERC20Metadata>(IERC20_ABI, enabledTrade._tokenOut);
    const symbolOut = await tokenOut.symbol();

    console.log(
      '[Execution] Processing trade of strategy',
      enabledTrade._strategy, // TODO Add strategy name
      'for',
      symbolIn,
      'to',
      symbolOut
    );

    const currentGas = gasprice.get(gasprice.Confidence.Highest);
    const gasPriceParams = {
      maxFeePerGas: MAX_GAS_PRICE,
      maxPriorityFeePerGas:
        currentGas.maxPriorityFeePerGas > FLASHBOT_MAX_PRIORITY_FEE_PER_GAS
          ? utils.parseUnits(`${currentGas.maxPriorityFeePerGas}`, 'gwei')
          : utils.parseUnits(`${FLASHBOT_MAX_PRIORITY_FEE_PER_GAS}`, 'gwei'),
    };

    let bestSetup: TradeSetup;
    let snapshotId;
    // Check if we need to run over a multicall swapper
    const multicallSolver = multicallSolvers.find((solver) => solver.match(enabledTrade));
    if (multicallSolver) {
      console.log('[Multicall] Taking snapshot of fork');

      snapshotId = (await network.provider.request({
        method: 'evm_snapshot',
        params: [],
      })) as string;

      console.log('[Multicall] Getting data');

      bestSetup = await multicallSolver.solve(enabledTrade as ExtendedEnabledTrade, tradeFactory);

      console.log('[Multicall] Reverting to snapshot');

      await network.provider.request({
        method: 'evm_revert',
        params: [snapshotId],
      });
    } else {
      bestSetup = null as any as TradeSetup;
    }

    if (!bestSetup) {
      console.log('no best setup, skip');
      continue;
    }

    // Execute in our fork
    console.log('[Execution] Executing trade in fork');
    console.log('tx data', bestSetup.transaction.data!);

    const simulatedTx = await ymech.sendTransaction(bestSetup.transaction);
    const confirmedTx = await simulatedTx.wait();
    console.log('[Execution] Simulation in fork succeeded used', confirmedTx.gasUsed.toString(), 'gas');

    await network.provider.request({
      method: 'evm_revert',
      params: [snapshotId],
    });

    const blockProtection = await ethers.getContractAt(BlockProtectionABI, '0xCC268041259904bB6ae2c84F9Db2D976BCEB43E5', ymech);

    await generateAndSendBundle({
      enabledTrade,
      blockProtection,
      bestSetup,
      wallet: ymech,
      executeTx: bestSetup.transaction,
      gasParams: {
        ...gasPriceParams,
        // gasLimit: confirmedTx.gasUsed.add(confirmedTx.gasUsed.div(5)),
        gasLimit: BigNumber.from(2_000_000),
      },
      nonce,
    });
  }
  await sleep(DELAY);
}

async function generateAndSendBundle(params: {
  enabledTrade: ITradeFactoryPositionsHandler.EnabledTradeStruct;
  blockProtection: any;
  bestSetup: TradeSetup;
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
    console.log('[Execution] Pending trade for', params.enabledTrade._strategy, 'executed via', params.bestSetup.swapperName);
    return true;
  }
  if (!params.retryNumber) params.retryNumber = 0;
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
