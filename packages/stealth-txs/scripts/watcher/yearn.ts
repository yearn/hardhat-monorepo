import { ethers, hardhatArguments, network } from 'hardhat';
import _ from 'lodash';
import { BigNumber, utils, Transaction, constants, Wallet } from 'ethers';
import * as contracts from '../../utils/contracts';
import Web3 from 'web3';
import { Account } from 'web3-core';
import * as gasprice from './tools/gasprice';
import * as alive from './tools/alive';
import { getChainId, getWSUrl } from './tools/env';
import { StealthVault, StealthRelayer } from '@typechained';
import {
  FlashbotsBundleProvider,
  FlashbotsBundleRawTransaction,
  FlashbotsBundleResolution,
  FlashbotsBundleTransaction,
  FlashbotsTransaction,
  FlashbotsTransactionResponse,
  SimulationResponse,
} from '@flashbots/ethers-provider-bundle';
import kms from '../../../commons/tools/kms';
import { normalizeAddress, getRawTransaction } from '../../../commons/utils/commons';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

type FlashbotBundle = Array<FlashbotsBundleTransaction | FlashbotsBundleRawTransaction>;
const MAX_GAS_PRICE = utils.parseUnits('350', 'gwei');
const MAX_PRIORITY_FEE_GAS_PRICE = 15;
const wsUrlProvider = getWSUrl(hardhatArguments.network!);
const stealthVaultAddress = contracts.stealthVault[hardhatArguments.network! as contracts.DeployedNetwork];
const stealthRelayerAddress = contracts.stealthRelayer[hardhatArguments.network! as contracts.DeployedNetwork];
const chainId = getChainId(hardhatArguments.network!);

const web3 = new Web3(wsUrlProvider);
const ethersWebSocketProvider = new ethers.providers.WebSocketProvider(wsUrlProvider, hardhatArguments.network!);

let nonce: BigNumber;
let reporterSigner: SignerWithAddress;
let web3ReporterSigner: Account;
let stealthVault: StealthVault;
let stealthRelayer: StealthRelayer;
let callers: string[];
let jobs: string[];
let flashbotsProvider: FlashbotsBundleProvider;
let stealthRelayerPenalty: BigNumber;
const bonded: { [keepers: string]: BigNumber } = {};
const callersJobs: { [keepers: string]: string[] } = {};
const checkedTxs: { [hash: string]: boolean } = {};

const generateRandomNumber = (min: number, max: number): string => {
  return `${Math.floor(Math.random() * (max - min) + min)}`;
};

async function setup(): Promise<void> {
  console.log(`[Setup] Starting on network ${hardhatArguments.network!}(${chainId}) ...`);
  alive.startCheck();
  console.log('[Setup] Getting reporter ...');
  [reporterSigner] = await ethers.getSigners();
  web3ReporterSigner = web3.eth.accounts.privateKeyToAccount(
    await kms.decrypt((chainId === 1 ? process.env.MAINNET_1_PRIVATE_KEY : process.env.GOERLI_1_PRIVATE_KEY) as string)
  );
  console.log('[Setup] Reporter address:', reporterSigner.address);
  nonce = BigNumber.from(await reporterSigner.getTransactionCount());
  console.log('[Setup] Reporter nonce:', nonce.toString());
  stealthVault = await ethers.getContractAt<StealthVault>('contracts/StealthVault.sol:StealthVault', stealthVaultAddress, reporterSigner);
  stealthVault.provider.call = ethersWebSocketProvider.call;
  stealthRelayer = await ethers.getContractAt<StealthRelayer>(
    'contracts/StealthRelayer.sol:StealthRelayer',
    stealthRelayerAddress,
    reporterSigner
  );
  alive.stillAlive();
  stealthRelayer.provider.call = ethersWebSocketProvider.call;
  console.log('[Setup] Creating flashbots provider ...');
  flashbotsProvider = await FlashbotsBundleProvider.create(
    ethers.provider, // a normal ethers.js provider, to perform gas estimiations and nonce lookups
    (await Wallet.createRandom()).connect(ethers.provider),
    // reporterSigner, // ethers.js signer wallet, only for signing request payloads, not transactions
    chainId !== 1 ? 'https://relay-goerli.flashbots.net/' : undefined,
    chainId !== 1 ? 'goerli' : undefined
  );
}

async function loadInformation(): Promise<void> {
  console.log('[Load information] Getting penalty ...');
  stealthRelayerPenalty = await stealthRelayer.penalty();
  alive.stillAlive();
  console.log('[Load information] Penalty set to', utils.formatEther(stealthRelayerPenalty));
  console.log('[Load information] Getting callers ...');
  callers = (await stealthVault.callers()).map((caller: string) => normalizeAddress(caller));
  alive.stillAlive();
  console.log('[Load information] Getting callers jobs ...');
  for (let i = 0; i < callers.length; i++) {
    addCallerStealthContracts(callers[i], await stealthVault.callerContracts(callers[i]));
    console.log('[Load information] Getting bonded from', callers[i]);
    addBond(callers[i], await stealthVault.bonded(callers[i]));
    alive.stillAlive();
  }
}

async function main(): Promise<void> {
  await gasprice.start();
  return new Promise(async (resolve) => {
    await setup();
    await loadInformation();

    console.log('[Main] Hooking up to mempool ...');
    ethersWebSocketProvider.on('pending', (txHash: string) => {
      ethersWebSocketProvider.getTransaction(txHash).then((transaction) => {
        alive.stillAlive();
        if (transaction && !checkedTxs[txHash]) {
          checkedTxs[txHash] = true;
          checkTx(transaction);
        }
      });
    });

    console.log('[Main] Hooking up to events ...');
    stealthRelayer.on('PenaltySet', (penalty: BigNumber) => {
      console.log('[Main] Updating penalty to', utils.formatEther(penalty));
      stealthRelayerPenalty = penalty;
    });
    stealthVault.on('StealthContractEnabled', (caller: string, job: string) => {
      console.log('[Main] Event StealthContractEnabled received');
      addCallerStealthContracts(caller, [job]);
    });
    stealthVault.on('StealthContractsEnabled', (caller: string, jobs: string[]) => {
      console.log('[Main] Event StealthContractsEnabled received');
      addCallerStealthContracts(caller, jobs);
    });
    stealthVault.on('StealthContractDisabled', (caller: string, job: string) => {
      console.log('[Main] Event StealthContractDisabled received');
      removeCallerStealthContracts(caller, [job]);
    });
    stealthVault.on('StealthContractsDisabled', (caller: string, jobs: string[]) => {
      console.log('[Main] Event StealthContractsDisabled received');
      removeCallerStealthContracts(caller, jobs);
    });
    stealthVault.on('Bonded', (caller: string, bonded: BigNumber, _: BigNumber) => {
      console.log('[Main] Event Bonded received');
      addBond(caller, bonded);
    });
    stealthVault.on('Unbonded', (caller: string, unbonded: BigNumber, _: BigNumber) => {
      console.log('[Main] Event Unbonded received');
      reduceBond(caller, unbonded);
    });
    stealthVault.on('PenaltyApplied', (hash: string, caller: string, penalty: BigNumber, reporter: string) => {
      console.log('[Main] Event PenaltyApplied received');
      reduceBond(caller, penalty);
      addBond(reporter, penalty.div(10));
    });
  });
}

async function checkTx(tx: Transaction) {
  const rand = generateRandomNumber(1, 100);
  console.time(`[Check TX] Whole tx analysis ${tx.hash}`);
  console.time(`[Check TX] Is using stealth relayer ${rand}-${tx.hash!}`);
  if (!isUsingStealthRelayer(tx.to!)) return;
  console.log('*****************************************');
  console.timeEnd(`[Check TX] Is using stealth relayer ${rand}-${tx.hash!}`);
  console.time(`[Check TX] Transaction parse ${rand}-${tx.hash!}`);
  const parsedTx = await stealthRelayer.interface.parseTransaction(tx);
  console.timeEnd(`[Check TX] Transaction parse ${rand}-${tx.hash!}`);
  console.time(`[Check TX] Transaction using stealth vault execution ${rand}-${tx.hash!}`);
  if (!isUsingStealthVaultExecution(parsedTx.name)) return;
  console.timeEnd(`[Check TX] Transaction using stealth vault execution ${rand}-${tx.hash!}`);
  // COMMENTED: If hash was already validated, flashbots simulation will fail and we will not report it
  // console.time(`[Check TX] Validating hash was not reported ${rand}-${tx.hash!}`);
  // if (await isHashReported(parsedTx.args._stealthHash)) return;
  // console.timeEnd(`[Check TX] Validating hash was not reported ${rand}-${tx.hash!}`);
  console.time(`[Check TX] Validate caller jobs ${rand}-${tx.hash!}`);
  if (!validCallerJobs(tx.from!, stealthRelayerAddress)) return;
  console.timeEnd(`[Check TX] Validate caller jobs ${rand}-${tx.hash!}`);
  console.time(`[Check TX] Validate bond for penalty ${rand}-${tx.hash!}`);
  if (!validBondForPenalty(tx.from!)) return;
  console.timeEnd(`[Check TX] Validate bond for penalty ${rand}-${tx.hash!}`);
  console.timeEnd(`[Check TX] Whole tx analysis ${tx.hash}`);
  await reportHash(parsedTx.args._stealthHash, tx);
  console.log('*****************************************');
}

async function reportHash(hash: string, transaction: Transaction): Promise<void> {
  console.log('[Reporting hash] Hash:', hash);
  const currentGas = gasprice.get(gasprice.Confidence.Highest);
  const gasParams = {
    maxFeePerGas: MAX_GAS_PRICE,
    maxPriorityFeePerGas:
      currentGas.maxPriorityFeePerGas > MAX_PRIORITY_FEE_GAS_PRICE
        ? utils.parseUnits(`${MAX_PRIORITY_FEE_GAS_PRICE}`, 'gwei')
        : utils.parseUnits(`${currentGas.maxPriorityFeePerGas}`, 'gwei'),
  };
  console.log('[Reporting hash] Max fee per gas:', utils.formatUnits(gasParams.maxFeePerGas, 'gwei'), 'gwei');
  console.log('[Reporting hash] Max priority fee per gas:', utils.formatUnits(gasParams.maxPriorityFeePerGas, 'gwei'), 'gwei');
  const populatedTx = await stealthVault.populateTransaction.reportHash(hash, {
    ...gasParams,
    gasLimit: BigNumber.from('100000'),
    nonce,
  });
  const signedTx = await web3ReporterSigner.signTransaction({
    ...gasParams,
    to: populatedTx.to!,
    gas: populatedTx.gasLimit!.toNumber(),
    data: populatedTx.data!,
  });
  const executorTx = getRawTransaction(transaction);
  const bundle: FlashbotBundle = [
    {
      signedTransaction: signedTx.rawTransaction!,
    },
    {
      signedTransaction: executorTx,
    },
  ];
  if (await submitBundle(bundle)) {
    nonce = nonce.add(1);
  }
}

async function submitBundle(bundle: FlashbotBundle): Promise<boolean> {
  let submitted = false;
  let rejected = false;
  const blockNumber = await ethers.provider.getBlockNumber();
  let targetBlock = blockNumber + 1;
  while (!(submitted || rejected)) {
    alive.stillAlive();
    if (!(await simulateBundle(bundle, targetBlock))) {
      rejected = true;
      continue;
    }
    const flashbotsTransactionResponse: FlashbotsTransaction = await flashbotsProvider.sendBundle(bundle, targetBlock);
    flashbotsProvider.sendBundle(bundle, targetBlock + 1);
    flashbotsProvider.sendBundle(bundle, targetBlock + 2);
    const resolution = await (flashbotsTransactionResponse as FlashbotsTransactionResponse).wait();
    if (resolution == FlashbotsBundleResolution.BundleIncluded) {
      console.log('[Flashbot] BundleIncluded, sucess!');
      submitted = true;
    } else if (resolution == FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
      console.log('[Flashbot] BlockPassedWithoutInclusion, re-build and re-send bundle');
    } else if (resolution == FlashbotsBundleResolution.AccountNonceTooHigh) {
      console.log('[Flashbot] AccountNonceTooHigh, adjust nonce');
      rejected = true;
    }
    targetBlock += 1;
  }
  return submitted;
}

async function simulateBundle(bundle: FlashbotBundle, blockNumber: number): Promise<boolean> {
  const signedBundle = await flashbotsProvider.signBundle(bundle);
  try {
    const simulation = await flashbotsProvider.simulate(signedBundle, blockNumber);
    if ('error' in simulation) {
      console.error(`[Flashbot] Simulation error: ${simulation.error.message}`);
    } else {
      console.log('[Flashbot] Simulation success !');
      return true;
    }
  } catch (error: any) {
    console.error('[Flashbot] Simulation error:', error.message);
  }
  return false;
}

function isUsingStealthRelayer(to: string): boolean {
  return to == stealthRelayerAddress;
}

function validCallerJobs(caller: string, jobs: string): boolean {
  caller = normalizeAddress(caller);
  jobs = normalizeAddress(jobs);
  if (!_.has(callersJobs, caller)) return false;
  if (!_.includes(callersJobs[caller], jobs)) return false;
  return true;
}

function validBondForPenalty(caller: string): boolean {
  return bonded[normalizeAddress(caller)].gte(stealthRelayerPenalty);
}

function isUsingStealthVaultExecution(functionName: string): boolean {
  return (
    functionName === 'execute' ||
    functionName === 'executeAndPay' ||
    functionName === 'executeWithoutBlockProtection' ||
    functionName === 'executeWithoutBlockProtectionAndPay'
  );
}

// async function isHashReported(hash: string): Promise<boolean> {
//   const hashReportedBy = await stealthVault.hashReportedBy(hash);
//   return hashReportedBy != constants.AddressZero;
// }

function addCallerStealthContracts(caller: string, callerContracts: string[]): void {
  console.log('[State update] Adding', callerContracts.length, 'jobs of', caller);
  callerContracts = callerContracts.map((cj) => normalizeAddress(cj));
  caller = normalizeAddress(caller);
  if (!_.has(callersJobs, caller)) callersJobs[caller] = [];
  callersJobs[caller] = _.union(callersJobs[caller], callerContracts);
  jobs = _.union(jobs, callerContracts);
}

function removeCallerStealthContracts(caller: string, callerContracts: string[]): void {
  console.log('[State update] Removing', callerContracts.length, 'jobs of', caller);
  callerContracts = callerContracts.map((cj) => normalizeAddress(cj));
  caller = normalizeAddress(caller);
  callersJobs[caller] = _.difference(callersJobs[caller], callerContracts);
  jobs = _.difference(jobs, callerContracts);
}

function reduceBond(caller: string, amount: BigNumber): void {
  console.log('[State update] Reducing', utils.formatEther(amount), 'of', caller, 'bonds');
  caller = normalizeAddress(caller);
  bonded[caller] = bonded[caller].sub(amount);
}

function addBond(caller: string, amount: BigNumber): void {
  console.log('[State update] Adding', utils.formatEther(amount), 'to', caller, 'bonds');
  caller = normalizeAddress(caller);
  if (!_.has(bonded, caller)) bonded[caller] = BigNumber.from('0');
  bonded[caller] = bonded[caller].add(amount);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('[Process] Unhandled rejection:', err);
  process.exit(1);
});
