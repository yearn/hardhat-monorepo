import { ethers, getChainId, network } from 'hardhat';
import sleep from 'sleep-promise';
import moment from 'moment';
import { BigNumber, Signer, utils } from 'ethers';
import { IERC20Metadata, TradeFactory, TradeFactoryExecutor, TradeFactoryExecutor__factory, TradeFactory__factory } from '@typechained';
import { abi as IERC20_ABI } from '@openzeppelin/contracts/build/contracts/IERC20Metadata.json';
import * as gasprice from './libraries/gasprice';
import Web3 from 'web3';
import { Account } from 'web3-core';
import {
  FlashbotsBundleProvider,
  FlashbotsBundleRawTransaction,
  FlashbotsBundleResolution,
  FlashbotsBundleTransaction,
  FlashbotsTransaction,
  FlashbotsTransactionResponse,
} from '@flashbots/ethers-provider-bundle';
import { PendingTrade, TradeSetup } from './types';
import { ThreePoolCrvMulticall } from './multicall/ThreePoolCrvMulticall';
import { Router } from './Router';
import { impersonate } from './utils';
import kms from '../../commons/tools/kms';
import { getNodeUrl } from '@utils/network';
import { WebSocketProvider } from '@ethersproject/providers';

const DELAY = moment.duration('3', 'minutes').as('milliseconds');
const MAX_GAS_PRICE = utils.parseUnits('350', 'gwei');
const MAX_PRIORITY_FEE_GAS_PRICE = 15;

// Flashbot
let web3ReporterSigner: Account;
let flashbotsProvider: FlashbotsBundleProvider;
let wsProvider: WebSocketProvider;

type FlashbotBundle = Array<FlashbotsBundleTransaction | FlashbotsBundleRawTransaction>;

async function main() {
  const chainId = await getChainId();
  console.log('[Setup] Chain ID:', chainId);

  const [signer] = await ethers.getSigners();
  const web3 = new Web3(getNodeUrl(chainId === '1' ? 'mainnet' : 'goerli'));
  web3ReporterSigner = web3.eth.accounts.privateKeyToAccount(
    await kms.decrypt((chainId === '1' ? process.env.MAINNET_1_PRIVATE_KEY : process.env.GOERLI_1_PRIVATE_KEY) as string)
  );
  const multicalls = [new ThreePoolCrvMulticall()];

  wsProvider = new ethers.providers.WebSocketProvider('wss://eth-mainnet.alchemyapi.io/v2/so5nW0P5_fel3fRHnpZxyyvdCVky2Nvz', 'mainnet');
  // console.log('[Setup] Creating flashbots provider ...');
  // flashbotsProvider = await FlashbotsBundleProvider.create(
  //   wsProvider, // a normal ethers.js provider, to perform gas estimiations and nonce lookups
  //   signer // ethers.js signer wallet, only for signing request payloads, not transactions
  // );

  const ymech: Signer = await impersonate('0xb82193725471dc7bfaab1a3ab93c7b42963f3265');
  console.log('[Setup] Executing with address', await ymech.getAddress());

  let tradeFactory: TradeFactory = TradeFactory__factory.connect('0xBf26Ff7C7367ee7075443c4F95dEeeE77432614d', ymech);

  // set current signer as TRADES_SETTLER for the test
  // if (!(await tradeFactory.hasRole(await tradeFactory.TRADES_SETTLER(), web3ReporterSigner.address))) {
  //   await tradeFactory.grantRole(await tradeFactory.TRADES_SETTLER(), web3ReporterSigner.address);
  // }

  const pendingTradesIds = await tradeFactory['pendingTradesIds()']();
  const pendingTrades: PendingTrade[] = [];

  for (const id of pendingTradesIds) {
    pendingTrades.push(await tradeFactory.pendingTradesById(id));
  }

  for (const pendingTrade of pendingTrades) {
    const tokenIn = await ethers.getContractAt<IERC20Metadata>(IERC20_ABI, pendingTrade._tokenIn);
    const decimalsIn = await tokenIn.decimals();
    const symbolIn = await tokenIn.symbol();

    console.log(
      '[Execution] Executing trade with id',
      pendingTrade._id.toNumber(),
      'of',
      utils.formatUnits(pendingTrade._amountIn, decimalsIn),
      symbolIn
    );

    // TODO: Uncomment. This removes expired trades
    // if (pendingTrade._deadline.lt(moment().unix())) {
    //   console.log(`Expiring trade ${pendingTrade._id.toString()}`);
    //   await tradeFactory.expire(pendingTrade._id);
    //   continue;
    // }

    let bestSetup: TradeSetup;

    // Check if we need to run over a multicall swapper
    const multicall = multicalls.find((mc) => mc.match(pendingTrade));
    if (multicall) {
      // continue;
      const snapshotId = (await network.provider.request({
        method: 'evm_snapshot',
        params: [],
      })) as string;

      bestSetup = await multicall.asyncSwap(pendingTrade);

      await network.provider.request({
        method: 'evm_revert',
        params: [snapshotId],
      });
    } else {
      // continue;
      bestSetup = await new Router().route(pendingTrade);
    }

    // TODO: This fails. Perhaps it's because we are inside a fork?
    // const currentGas = gasprice.get(gasprice.Confidence.Highest);
    // const gasParams = {
    //   maxFeePerGas: MAX_GAS_PRICE,
    //   maxPriorityFeePerGas:
    //     currentGas.maxPriorityFeePerGas > MAX_PRIORITY_FEE_GAS_PRICE
    //       ? utils.parseUnits(`${MAX_PRIORITY_FEE_GAS_PRICE}`, 'gwei')
    //       : utils.parseUnits(`${currentGas.maxPriorityFeePerGas}`, 'gwei'),
    // };

    // Hardcoded for now
    const gasParams = {
      maxFeePerGas: utils.parseUnits('180', 'gwei'),
      maxPriorityFeePerGas: utils.parseUnits('3.5', 'gwei'),
    };

    // Execute in our fork
    console.log('[Execution] Executing trade in fork');
    await tradeFactory['execute(uint256,address,uint256,bytes)'](pendingTrade._id, bestSetup.swapper, bestSetup.minAmountOut!, bestSetup.data);
    console.log('[Execution] Simulation in fork succeeded !');

    const protect = new ethers.providers.JsonRpcProvider('https://rpc.flashbots.net');

    const populatedTx = await tradeFactory.populateTransaction['execute(uint256,address,uint256,bytes)'](
      pendingTrade._id,
      bestSetup.swapper,
      bestSetup.minAmountOut!,
      bestSetup.data,
      {
        ...gasParams,
        gasLimit: BigNumber.from('3000000'), // TODO why are we hardcoding gas here? (either use estimateGas of leave empty)
      }
    );
    const signedTx = await web3ReporterSigner.signTransaction({
      ...gasParams,
      to: populatedTx.to!,
      gas: populatedTx.gasLimit!.toNumber(),
      data: populatedTx.data!,
    });

    console.log('[Execution] Sending transaction in block', await wsProvider.getBlockNumber());
    const asd = await protect.sendTransaction(signedTx.rawTransaction!);
    console.log('asd', asd);
    // const bundle: FlashbotBundle = [
    //   {
    //     signedTransaction: signedTx.rawTransaction!,
    //   },
    // ];
    // console.log('[Execution] Signed with hash:', signedTx.transactionHash!);
    // if (await submitBundle(bundle)) console.log('[Execution] Pending trade', pendingTrade._id, 'executed via', bestSetup.swapper);
    await sleep(DELAY);
  }
}

async function submitBundle(bundle: FlashbotBundle): Promise<boolean> {
  let submitted = false;
  let rejected = false;
  const blockNumber = await wsProvider.getBlockNumber();
  let targetBlock = blockNumber + 1;
  while (!(submitted || rejected)) {
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

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
