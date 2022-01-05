import axios from 'axios';
import moment from 'moment';
import { Transaction as Web3Transaction } from 'web3-core';
import { ethers } from 'hardhat';
import _ from 'lodash';
import StealthVault from '../../artifacts/contracts/StealthVault.sol/StealthVault.json';
import { BigNumber, Contract, Transaction as EthersTransaction } from 'ethers';
import { createAlchemyWeb3 } from '@alch/alchemy-web3';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

// Using WebSockets
const web3 = createAlchemyWeb3('wss://eth-kovan.ws.alchemyapi.io/v2/OAh_8Jbu8aMsuFAj1n8gRzo8PPRfK7VP');

const stealthVaultAddress = '0x4F15455166895e7B0D98715C1e540BbA2718A526';
const stealthVaultInterface = new ethers.utils.Interface(StealthVault.abi);
let nonce: number;
let reporter: SignerWithAddress;
let stealthVault: Contract;
let callers: string[];
let jobs: string[];
const callersJobs: { [key: string]: string[] } = {};

axios.defaults.headers.post['X-Access-Key'] = process.env.TENDERLY_ACCESS_TOKEN;

const generateRandomNumber = (min: number, max: number): string => {
  return `${Math.floor(Math.random() * (max - min) + min)}`;
};

async function main() {
  return new Promise(async () => {
    console.log('Starting ...');
    console.log('Getting reporter ...');
    [, reporter] = await ethers.getSigners();
    nonce = await reporter.getTransactionCount();
    stealthVault = await ethers.getContractAt('contracts/StealthVault.sol:StealthVault', stealthVaultAddress, reporter);
    console.log('Getting callers ...');
    callers = (await stealthVault.callers()).map((caller: string) => caller.toLowerCase());
    console.log('Getting callers jobs ...');
    for (let i = 0; i < callers.length; i++) {
      const callerContracts = (await stealthVault.callerContracts(callers[i])).map((callerJob: string) => callerJob.toLowerCase());
      console.log('Adding', callerContracts.length, 'jobs of', callers[i]);
      callersJobs[callers[i]] = callerContracts;
      jobs = _.merge(jobs, callerContracts);
    }
    console.log('Hooking up to mempool ...');

    web3.eth.subscribe('alchemy_fullPendingTransactions', (err: Error, tx: Web3Transaction) => {
      checkTx(web3TransactionToEthers(tx));
    });
  });
}

function web3TransactionToEthers(tx: Web3Transaction): EthersTransaction {
  return {
    chainId: 42,
    hash: tx.hash,
    nonce: tx.nonce,
    from: tx.from,
    to: tx.to!,
    gasLimit: BigNumber.from(tx.gas),
    gasPrice: BigNumber.from(tx.gasPrice),
    data: tx.input,
    value: BigNumber.from(tx.value),
  };
}

async function checkTx(tx: EthersTransaction) {
  const POST_DATA = {
    network_id: '42',
    from: tx.from!,
    to: tx.to!,
    input: tx.data,
    gas: tx.gasLimit.toNumber(),
    gas_price: tx.gasPrice.toString(),
    value: tx.value.toString(),
    save: true,
    save_if_fails: true,
    simulation_type: 'quick',
  };
  const rand = generateRandomNumber(1, 1000000000);
  console.time(`Validate caller ${rand}-${tx.hash!}`);
  if (!validCaller(tx.from!)) return;
  console.timeEnd(`Validate caller ${rand}-${tx.hash!}`);
  console.log('arrived at', moment().unix());
  console.time(`Simulation ${rand}-${tx.hash!}`);
  const tenderlyResponse = await axios.post(
    `https://api.tenderly.co/api/v1/account/yearn/project/${process.env.TENDERLY_PROJECT}/simulate`,
    POST_DATA
  );
  console.timeEnd(`Simulation ${rand}-${tx.hash!}`);
  if (doesTransactionRevert(tenderlyResponse.data.transaction)) return;
  if (isContractCreation(tenderlyResponse.data.transaction)) return;
  const isValidating = isValidatingHash(tenderlyResponse.data.transaction.transaction_info.call_trace.calls);
  if (!isValidating.validating) return;
  const logs = tenderlyResponse.data.transaction.transaction_info.logs;
  if (logs[isValidating.index!].raw.address.toLowerCase() === stealthVaultAddress.toLowerCase()) {
    const parsedLogs = stealthVaultInterface.parseLog(logs[isValidating.index!].raw);
    if (parsedLogs.name === 'ValidatedHash') {
      await reportHash(parsedLogs.args._hash, tx.gasPrice);
    }
  }
}
function doesTransactionRevert(transaction: any): boolean {
  if (!transaction.status) return true;
  return false;
}

function isContractCreation(transaction: any): boolean {
  if (!transaction.transaction_info.call_trace.calls) return true;
  return false;
}

function isValidatingHash(calls: any[]): { validating: boolean; index?: number } {
  for (let i = 0; i < calls.length; i++) {
    if (calls[i].to.toLowerCase() === stealthVaultAddress.toLowerCase().toLowerCase()) {
      if (!validJob(calls[i].from)) return { validating: false };
      return {
        validating: true,
        index: i,
      };
    }
  }
  return {
    validating: false,
  };
}

async function reportHash(hash: string, gasPrice: BigNumber): Promise<void> {
  console.log('reporting hash', hash);
  nonce++;
  const populatedTx = await stealthVault.populateTransaction.reportHash(hash, { gasLimit: 1000000, gasPrice: gasPrice.mul(3), nonce });
  const signedtx = await web3.eth.accounts.signTransaction(
    {
      to: stealthVaultAddress,
      gasPrice: web3.utils.toWei('15', 'gwei'),
      gas: '100000',
      data: populatedTx.data!,
    },
    process.env.KOVAN_2_PRIVATE_KEY as string
  );
  const promiEvent = await web3.eth.sendSignedTransaction(signedtx.rawTransaction!, (error: Error, hash: string) => {
    console.log('Sent report with tx hash', hash);
  });
}

function validCaller(caller: string): boolean {
  return _.includes(callers, caller);
}

function validJob(job: string): boolean {
  return _.includes(jobs, job);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
