import axios from 'axios';
import moment from 'moment';

const TIMEOUT = moment.duration('4', 'seconds').as('milliseconds');
const INTERVAL = moment.duration('8', 'seconds').as('milliseconds');

let quoteInterval: NodeJS.Timer;
let last: TxPriceResponse;

export enum Confidence {
  Highest = 99,
  High = 95,
  Medium = 90,
  Low = 80,
  Lowest = 70,
}

type TxPriceResponse = {
  system: string;
  network: string;
  unit: string;
  maxPrice: number;
  currentBlockNumber: number;
  msSinceLastBlock: number;
  blockPrices: BlockPrices;
};

type BlockPrices = BlockPrice[];

type BlockPrice = {
  blockNumber: number;
  baseFeePerGas: number;
  estimatedTransactionCount: number;
  estimatedPrices: EstimatedPrice[];
};

type EstimatedPrice = {
  confidence: Confidence;
  price: number;
  maxPriorityFeePerGas: number;
  maxFeePerGas: number;
};

export const quote = async (): Promise<void> => {
  try {
    const response = await axios.get(`https://api.txprice.com/`, { timeout: TIMEOUT });
    last = response.data as TxPriceResponse;
  } catch (err) {
    console.error('Error while quoting gas price:', err);
  }
};

export const start = async () => {
  console.log('[Gasprice] Starting');
  await quote();
  quoteInterval = setInterval(quote, INTERVAL);
};

export const stop = async () => {
  console.log('[Gasprice] Stopping');
  if (quoteInterval) clearInterval(quoteInterval);
};

export const get = (confidence: Confidence): EstimatedPrice => {
  const estimatedPrice = last.blockPrices[0].estimatedPrices.find((estimatedPrice) => estimatedPrice.confidence == confidence);
  if (!estimatedPrice) throw Error('No price with that confidence');
  return estimatedPrice;
};
