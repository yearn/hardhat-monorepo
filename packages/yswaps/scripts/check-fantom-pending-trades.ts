import { ethers, network } from 'hardhat';
import { BigNumber, PopulatedTransaction, utils, Wallet } from 'ethers';
import { IERC20Metadata__factory, TradeFactory } from '@typechained';
import sleep from 'sleep-promise';
import moment from 'moment';
import * as gasprice from './libraries/utils/ftm-gas-price';
import kms from '../../commons/tools/kms';
import { getNodeUrl } from '@utils/network';
import { JsonRpcProvider } from '@ethersproject/providers';
import * as evm from '@test-utils/evm';
import { getFantomSolversMap, fantomConfig } from '@scripts/configs/fantom';
import { Solver } from './libraries/types';
import { formatUnits, parseUnits } from '@ethersproject/units';

const DELAY = moment.duration('8', 'minutes').as('milliseconds');
const RETRIES = 10;
const MAX_GAS_PRICE = utils.parseUnits('1500', 'gwei');

// Provider
let fantomProvider: JsonRpcProvider;

async function main() {
  console.log('# Check Fantom pending trades');
  await gasprice.start();

  console.log('[Setup] Forking fantom');

  process.env.HARDHAT_DEPLOY_FORK = 'fantom';
  await evm.reset({
    jsonRpcUrl: getNodeUrl('fantom'),
  });

  const ymech = new ethers.Wallet(await kms.decrypt(process.env.FANTOM_1_PRIVATE_KEY as string), ethers.provider);

  const tradeFactory: TradeFactory = await ethers.getContract('TradeFactory');
  const enabledTrades = (await tradeFactory.enabledTrades()).map((enabledTrade) => ({
    strategy: enabledTrade._strategy,
    tokenIn: enabledTrade._tokenIn,
    tokenOut: enabledTrade._tokenOut,
  }));
  console.log('------------');

  // do we have consistency on our strategies?
  const enabledTradesStrategies = enabledTrades.map((enabledTrade) => enabledTrade.strategy);
  const extraStrategiesOnConfig = Object.keys(fantomConfig).filter((strategy) => enabledTradesStrategies.indexOf(strategy) == -1);
  if (extraStrategiesOnConfig.length > 0) console.log('extraStrategiesOnConfig', extraStrategiesOnConfig);
  const extraStrategiesOnTradeFactory = enabledTradesStrategies.filter((strategy) => Object.keys(fantomConfig).indexOf(strategy) == -1);
  if (extraStrategiesOnTradeFactory.length > 0) console.log('extraStrategiesOnTradeFactory', extraStrategiesOnTradeFactory);

  for (const strategy in fantomConfig) {
    const tradesConfig = fantomConfig[strategy];
    console.log('strategy:', strategy);
    for (const tradeConfig of tradesConfig.tradesConfigurations) {
      console.log('with solver:', tradeConfig.solver);
      for (const enabledTrade of tradeConfig.enabledTrades) {
        const tokenIn = IERC20Metadata__factory.connect(enabledTrade.tokenIn, ymech);
        const amountIn = await tokenIn.balanceOf(strategy);
        let decimals = 18;
        try {
          decimals = await tokenIn.decimals();
        } catch (error) {}
        console.log(`${await tokenIn.symbol()}:`, formatUnits(amountIn.toString(), decimals));
      }
      console.log('************');
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
