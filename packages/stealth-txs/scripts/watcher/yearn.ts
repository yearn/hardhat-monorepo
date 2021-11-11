import { ethers, hardhatArguments, network } from 'hardhat';
import _ from 'lodash';
import { BigNumber, utils, Transaction, constants, Wallet } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import * as contracts from '../../utils/contracts';
import Web3 from 'web3';
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
import { TransactionDescription } from '@ethersproject/abi';
import { encode } from 'rlp';
import kms from '../../../commons/tools/kms';

type FlashbotBundle = Array<FlashbotsBundleTransaction | FlashbotsBundleRawTransaction>;
const MAX_GAS_PRICE = utils.parseUnits('350', 'gwei');
const MAX_PRIORITY_FEE_GAS_PRICE = 30;
const wsUrlProvider = getWSUrl(hardhatArguments.network!);
const stealthVaultAddress = contracts.stealthVault[hardhatArguments.network! as contracts.DeployedNetwork];
const stealthRelayerAddress = contracts.stealthRelayer[hardhatArguments.network! as contracts.DeployedNetwork];
const chainId = getChainId(hardhatArguments.network!);

const web3 = new Web3(wsUrlProvider);
const ethersWebSocketProvider = new ethers.providers.WebSocketProvider(wsUrlProvider, hardhatArguments.network!);

let nonce: BigNumber;
let reporterSigner: SignerWithAddress;
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
  console.log(`Starting on network ${hardhatArguments.network!}(${chainId}) ...`);
  alive.startCheck();
  console.log('Getting reporter ...');
  [reporterSigner] = await ethers.getSigners();
  console.log('Reporter address:', reporterSigner.address);
  nonce = BigNumber.from(await reporterSigner.getTransactionCount());
  console.log('Reporter nonce:', nonce.toString());
  stealthVault = await ethers.getContractAt<StealthVault>('contracts/StealthVault.sol:StealthVault', stealthVaultAddress, reporterSigner);
  stealthVault.provider.call = ethersWebSocketProvider.call;
  stealthRelayer = await ethers.getContractAt<StealthRelayer>(
    'contracts/StealthRelayer.sol:StealthRelayer',
    stealthRelayerAddress,
    reporterSigner
  );
  alive.startCheck();
  stealthRelayer.provider.call = ethersWebSocketProvider.call;
  console.log('Creating flashbots provider ...');
  flashbotsProvider = await FlashbotsBundleProvider.create(
    ethers.provider, // a normal ethers.js provider, to perform gas estimiations and nonce lookups
    (await Wallet.createRandom()).connect(ethers.provider),
    // reporterSigner, // ethers.js signer wallet, only for signing request payloads, not transactions
    chainId !== 1 ? 'https://relay-goerli.flashbots.net/' : undefined,
    chainId !== 1 ? 'goerli' : undefined
  );
}

async function loadInformation(): Promise<void> {
  console.log('Getting penalty ...');
  stealthRelayerPenalty = await stealthRelayer.penalty();
  alive.stillAlive();
  console.log('Penalty set to', utils.formatEther(stealthRelayerPenalty));
  console.log('Getting callers ...');
  callers = (await stealthVault.callers()).map((caller: string) => normalizeAddress(caller));
  alive.stillAlive();
  console.log('Getting callers jobs ...');
  for (let i = 0; i < callers.length; i++) {
    addCallerStealthContracts(callers[i], await stealthVault.callerContracts(callers[i]));
    console.log('Getting bonded from', callers[i]);
    addBond(callers[i], await stealthVault.bonded(callers[i]));
    alive.stillAlive();
  }
}

async function main(): Promise<void> {
  await gasprice.start();
  return new Promise(async (resolve) => {
    await setup();
    await loadInformation();

    console.log('Hooking up to mempool ...');
    ethersWebSocketProvider.on('pending', (txHash: string) => {
      ethersWebSocketProvider.getTransaction(txHash).then((transaction) => {
        alive.stillAlive();
        if (transaction && !checkedTxs[txHash]) {
          checkedTxs[txHash] = true;
          checkTx(transaction);
        }
      });
    });

    console.log('Hooking up to events ...');
    stealthRelayer.on('PenaltySet', (penalty: BigNumber) => {
      console.log('Updating penalty to', utils.formatEther(penalty));
      stealthRelayerPenalty = penalty;
    });
    stealthVault.on('StealthContractEnabled', (caller: string, job: string) => {
      addCallerStealthContracts(caller, [job]);
    });
    stealthVault.on('StealthContractsEnabled', (caller: string, jobs: string[]) => {
      addCallerStealthContracts(caller, jobs);
    });
    stealthVault.on('StealthContractDisabled', (caller: string, job: string) => {
      removeCallerStealthContracts(caller, [job]);
    });
    stealthVault.on('StealthContractsDisabled', (caller: string, jobs: string[]) => {
      removeCallerStealthContracts(caller, jobs);
    });
    stealthVault.on('Bonded', (caller: string, bonded: BigNumber, _: BigNumber) => {
      addBond(caller, bonded);
    });
    stealthVault.on('Unbonded', (caller: string, unbonded: BigNumber, _: BigNumber) => {
      reduceBond(caller, unbonded);
    });
    stealthVault.on('PenaltyApplied', (hash: string, caller: string, penalty: BigNumber, reporter: string) => {
      reduceBond(caller, penalty);
      addBond(reporter, penalty.div(10));
    });
  });
}

async function checkTx(tx: Transaction) {
  const rand = generateRandomNumber(1, 1000000000);
  console.time(`Whole tx analysis ${tx.hash}`);
  console.time(`Is using stealth relayer ${rand}-${tx.hash!}`);
  if (!isUsingStealthRelayer(tx.to!)) return;
  console.log('*****************************************');
  console.timeEnd(`Is using stealth relayer ${rand}-${tx.hash!}`);
  console.time(`Transaction parse ${rand}-${tx.hash!}`);
  const parsedTx = await stealthRelayer.interface.parseTransaction(tx);
  console.timeEnd(`Transaction parse ${rand}-${tx.hash!}`);
  console.time(`Transaction using stealth vault execution ${rand}-${tx.hash!}`);
  if (!isUsingStealthVaultExecution(parsedTx.name)) return;
  console.timeEnd(`Transaction using stealth vault execution ${rand}-${tx.hash!}`);
  console.time(`Validating hash was not reported ${rand}-${tx.hash!}`);
  if (await isHashReported(parsedTx.args._stealthHash)) return;
  console.timeEnd(`Validating hash was not reported ${rand}-${tx.hash!}`);
  console.time(`Validate caller jobs ${rand}-${tx.hash!}`);
  if (!validCallerJobs(tx.from!, stealthRelayerAddress)) return;
  console.timeEnd(`Validate caller jobs ${rand}-${tx.hash!}`);
  console.time(`Validate bond for penalty ${rand}-${tx.hash!}`);
  if (!validBondForPenalty(tx.from!)) return;
  console.timeEnd(`Validate bond for penalty ${rand}-${tx.hash!}`);
  console.timeEnd(`Whole tx analysis ${tx.hash}`);
  await reportHash(parsedTx.args._stealthHash, tx);
  console.log('*****************************************');
}

async function reportHash(hash: string, transaction: Transaction): Promise<void> {
  console.log('reporting hash', hash);
  const currentGas = gasprice.get(gasprice.Confidence.Highest);
  const gasParams = {
    maxFeePerGas: MAX_GAS_PRICE,
    maxPriorityFeePerGas:
      currentGas.maxPriorityFeePerGas > MAX_PRIORITY_FEE_GAS_PRICE
        ? utils.parseUnits(`${MAX_PRIORITY_FEE_GAS_PRICE}`, 'gwei')
        : utils.parseUnits(`${currentGas.maxPriorityFeePerGas}`, 'gwei'),
  };
  gasParams.maxPriorityFeePerGas = utils.parseUnits('8', 'gwei');
  console.log('gas params max fee per gas', utils.formatUnits(gasParams.maxFeePerGas, 'gwei'));
  console.log('gas params max priority', utils.formatUnits(gasParams.maxPriorityFeePerGas, 'gwei'));
  const populatedTx = await stealthVault.populateTransaction.reportHash(hash, {
    ...gasParams,
    gasLimit: 100000,
    nonce,
  });
  const signer = new ethers.Wallet(await kms.decrypt(process.env.GOERLI_1_PRIVATE_KEY as string));
  const signedTx = await signer.signTransaction(populatedTx);
  const executorTx = getRawTransaction(transaction);
  const bundle: FlashbotBundle = [
    {
      signedTransaction: signedTx,
    },
    // {
    //   signedTransaction: executorTx,
    // },
  ];
  if (await submitBundle(bundle)) {
    nonce = nonce.add(1);
  }
}

async function submitBundle(bundle: FlashbotBundle): Promise<boolean> {
  let submitted = false;
  let rejected = false;
  const blockNumber = await ethers.provider.getBlockNumber();
  while (!submitted || rejected) {
    let targetBlock = blockNumber + 1;
    if (!(await simulateBundle(bundle, targetBlock))) rejected = true;
    const flashbotsTransactionResponse: FlashbotsTransaction = await flashbotsProvider.sendBundle(bundle, targetBlock);
    flashbotsProvider.sendBundle(bundle, targetBlock + 1);
    flashbotsProvider.sendBundle(bundle, targetBlock + 2);
    flashbotsProvider.sendBundle(bundle, targetBlock + 3);
    flashbotsProvider.sendBundle(bundle, targetBlock + 4);
    flashbotsProvider.sendBundle(bundle, targetBlock + 5);
    flashbotsProvider.sendBundle(bundle, targetBlock + 6);
    flashbotsProvider.sendBundle(bundle, targetBlock + 7);
    flashbotsProvider.sendBundle(bundle, targetBlock + 8);
    flashbotsProvider.sendBundle(bundle, targetBlock + 9);
    flashbotsProvider.sendBundle(bundle, targetBlock + 10);
    flashbotsProvider.sendBundle(bundle, targetBlock + 11);
    const resolution = await (flashbotsTransactionResponse as FlashbotsTransactionResponse).wait();
    if (resolution == FlashbotsBundleResolution.BundleIncluded) {
      console.log('BundleIncluded, sucess!');
      submitted = true;
    } else if (resolution == FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
      console.log('BlockPassedWithoutInclusion, re-build and re-send bundle...');
    } else if (resolution == FlashbotsBundleResolution.AccountNonceTooHigh) {
      console.log('AccountNonceTooHigh, adjust nonce');
      rejected = true;
    }
    targetBlock += 1;
  }
  return submitted;
}

async function simulateBundle(bundle: FlashbotBundle, blockNumber: number): Promise<boolean> {
  const signedBundle = await flashbotsProvider.signBundle(bundle);
  let simulation: SimulationResponse;
  try {
    simulation = await flashbotsProvider.simulate(signedBundle, blockNumber + 1);
    if ('error' in simulation) {
      console.error(`Simulation Error: ${simulation.error.message}`);
    } else {
      console.log(`Simulation Success !`);
      return true;
    }
  } catch (error: any) {
    if ('body' in error && 'message' in JSON.parse(error.body).error) {
      console.log('[Simulation Error] Message:', JSON.parse(error.body).error.message);
    } else {
      console.log(error);
    }
    console.error('simulation error');
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
  console.log(bonded[normalizeAddress(caller)].toString(), stealthRelayerPenalty.toString());
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

async function isHashReported(hash: string): Promise<boolean> {
  const hashReportedBy = await stealthVault.hashReportedBy(hash);
  return hashReportedBy != constants.AddressZero;
}

function addCallerStealthContracts(caller: string, callerContracts: string[]): void {
  console.log('Adding', callerContracts.length, 'jobs of', caller);
  callerContracts = callerContracts.map((cj) => normalizeAddress(cj));
  caller = normalizeAddress(caller);
  if (!_.has(callersJobs, caller)) callersJobs[caller] = [];
  callersJobs[caller] = _.union(callersJobs[caller], callerContracts);
  jobs = _.union(jobs, callerContracts);
}

function removeCallerStealthContracts(caller: string, callerContracts: string[]): void {
  console.log('Removing', callerContracts.length, 'jobs of', caller);
  callerContracts = callerContracts.map((cj) => normalizeAddress(cj));
  caller = normalizeAddress(caller);
  callersJobs[caller] = _.difference(callersJobs[caller], callerContracts);
  jobs = _.difference(jobs, callerContracts);
}

function reduceBond(caller: string, amount: BigNumber): void {
  console.log('Reducing', utils.formatEther(amount), 'of', caller, 'bonds');
  caller = normalizeAddress(caller);
  bonded[caller] = bonded[caller].sub(amount);
}

function addBond(caller: string, amount: BigNumber): void {
  console.log('Adding', utils.formatEther(amount), 'to', caller, 'bonds');
  caller = normalizeAddress(caller);
  if (!_.has(bonded, caller)) bonded[caller] = BigNumber.from('0');
  bonded[caller] = bonded[caller].add(amount);
}

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

// Ref: https://docs.ethers.io/v5/cookbook/transactions/#cookbook--compute-raw-transaction
// Ugly but works
function getRawTransaction(transaction: Transaction): string {
  // function addKey(accum: any, key: string) {
  //   if ((transaction as any)[key]) { accum[key] = (transaction as any)[key]; }
  //   return accum;
  // }

  // // Extract the relevant parts of the transaction and signature
  // const txFields = "accessList chainId data gasPrice gasLimit maxFeePerGas maxPriorityFeePerGas nonce to type value".split(" ");
  // const sigFields = "v r s".split(" ");

  // // Seriailze the signed transaction
  // const raw = utils.serializeTransaction(txFields.reduce(addKey, { }), sigFields.reduce(addKey, { }));

  // // Double check things went well
  // if (utils.keccak256(raw) !== transaction.hash) { throw new Error("serializing failed!"); }

  // return raw;

  const executorTx = encode([
    transaction.chainId,
    transaction.nonce,
    transaction.maxPriorityFeePerGas!.toNumber(),
    transaction.maxFeePerGas!.toNumber(),
    transaction.gasLimit.toNumber(),
    transaction.to!,
    transaction.value.toNumber(),
    transaction.data,
    [], // access list
    transaction.v!,
    transaction.r!,
    transaction.s!,
  ]);

  return `0x02${executorTx.toString('hex')}`;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});
