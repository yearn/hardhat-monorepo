import axios from 'axios';
import moment from 'moment';

const TIMEOUT = moment.duration('3', 'seconds').as('milliseconds');
const INTERVAL = moment.duration('6', 'seconds').as('milliseconds');

let quoteInterval: NodeJS.Timer;
let last: TxPriceResponse;

type TxPriceResponse = {
  status: number;
  message: string;
  result: GasResults;
};

type GasResults = {
  LastBlock: number;
  SafeGasPrice: number;
  ProposeGasPrice: number;
  FastGasPrice: number;
  UsdPrice: number;
};

export const quote = async (): Promise<void> => {
  try {
    const response = await axios.get(`https://gftm.blockscan.com/gasapi.ashx?apikey=key&method=gasoracle`, { timeout: TIMEOUT });
    last = response.data as TxPriceResponse;
  } catch (err) {
    console.error('[GasPrice] Error while quoting gas price:', err);
  }
};

export const start = async () => {
  console.log('[GasPrice] Starting');
  await quote();
  quoteInterval = setInterval(quote, INTERVAL);
};

export const stop = async () => {
  if (quoteInterval) clearInterval(quoteInterval);
};

export const get = (): number => last.result.FastGasPrice;
