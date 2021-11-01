import { expect } from 'chai';
import { JsonRpcSigner } from '@ethersproject/providers';
import { utils, Wallet } from 'ethers';
import { evm, wallet } from '@test-utils';
import { then } from '@test-utils/bdd';
import { getNodeUrl } from '@utils/network';
import zrx, { QuoteResponse } from '@scripts/libraries/zrx';
import * as setup from '../setup';
import { IERC20, ISwapper, TradeFactory } from '@typechained';

describe('ZRX', function () {
  let yMech: JsonRpcSigner;
  let strategy: Wallet;

  let tradeFactory: TradeFactory;
  let swapper: ISwapper;

  let snapshotId: string;

  context('on mainnet', () => {
    const CHAIN_ID = 1;

    const CRV_ADDRESS = '0xD533a949740bb3306d119CC777fa900bA034cd52';
    const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f';

    const CRV_WHALE_ADDRESS = '0xd2d43555134dc575bf7279f4ba18809645db0f1d';

    let CRV: IERC20;
    let DAI: IERC20;

    const AMOUNT_IN = utils.parseEther('10000');

    let zrxAPIResponse: QuoteResponse;

    before(async () => {
      strategy = await wallet.generateRandom();

      await evm.reset({
        jsonRpcUrl: getNodeUrl('mainnet'),
      });

      // We get information for trade first, 1inch API starts returning non-valid data

      zrxAPIResponse = await zrx.quote({
        chainId: CHAIN_ID,
        sellToken: CRV_ADDRESS,
        buyToken: DAI_ADDRESS,
        sellAmount: AMOUNT_IN,
        slippagePercentage: 0.05,
      });

      ({
        fromToken: CRV,
        toToken: DAI,
        yMech,
        tradeFactory,
        swapper,
      } = await setup.async({
        chainId: CHAIN_ID,
        fixture: ['Common', 'ZRX'],
        swapper: 'ZRX',
        fromTokenAddress: CRV_ADDRESS,
        toTokenAddress: DAI_ADDRESS,
        fromTokenWhaleAddress: CRV_WHALE_ADDRESS,
        amountIn: AMOUNT_IN,
        strategy,
      }));

      snapshotId = await evm.snapshot.take();
    });

    beforeEach(async () => {
      await evm.snapshot.revert(snapshotId);
    });

    describe('swap', () => {
      beforeEach(async () => {
        await tradeFactory
          .connect(yMech)
          ['execute(uint256,address,uint256,bytes)'](1, swapper.address, zrxAPIResponse.minAmountOut!, zrxAPIResponse.data);
      });

      then('CRV gets taken from strategy', async () => {
        expect(await CRV.balanceOf(strategy.address)).to.equal(0);
      });

      then('DAI gets airdropped to strategy', async () => {
        expect(await DAI.balanceOf(strategy.address)).to.be.gt(0);
      });
    });
  });

  context('on fantom', () => {
    const CHAIN_ID = 250;

    const WFTM_ADDRESS = '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83';
    const DAI_ADDRESS = '0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e';

    const WFTM_WHALE_ADDRESS = '0x39b3bd37208cbade74d0fcbdbb12d606295b430a';

    let WFTM: IERC20;
    let DAI: IERC20;

    const AMOUNT_IN = utils.parseEther('10000');

    let zrxAPIResponse: QuoteResponse;

    before(async () => {
      strategy = await wallet.generateRandom();

      await evm.reset({
        jsonRpcUrl: getNodeUrl('fantom'),
      });

      // We get information for trade first, 1inch API starts returning non-valid data

      zrxAPIResponse = await zrx.quote({
        chainId: CHAIN_ID,
        sellToken: WFTM_ADDRESS,
        buyToken: DAI_ADDRESS,
        sellAmount: AMOUNT_IN,
        slippagePercentage: 0.05,
      });

      ({
        fromToken: WFTM,
        toToken: DAI,
        yMech,
        tradeFactory,
        swapper,
      } = await setup.async({
        chainId: CHAIN_ID,
        fixture: ['Common', 'ZRX'],
        swapper: 'ZRX',
        fromTokenAddress: WFTM_ADDRESS,
        toTokenAddress: DAI_ADDRESS,
        fromTokenWhaleAddress: WFTM_WHALE_ADDRESS,
        amountIn: AMOUNT_IN,
        strategy,
      }));

      snapshotId = await evm.snapshot.take();
    });

    beforeEach(async () => {
      await evm.snapshot.revert(snapshotId);
    });

    describe('swap', () => {
      beforeEach(async () => {
        await tradeFactory
          .connect(yMech)
          ['execute(uint256,address,uint256,bytes)'](1, swapper.address, zrxAPIResponse.minAmountOut!, zrxAPIResponse.data);
      });

      then('WFTM gets taken from strategy', async () => {
        expect(await WFTM.balanceOf(strategy.address)).to.equal(0);
      });

      then('DAI gets airdropped to strategy', async () => {
        expect(await DAI.balanceOf(strategy.address)).to.be.gt(0);
      });
    });
  });

  context('on polygon', () => {
    const CHAIN_ID = 137;

    const WMATIC_ADDRESS = '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270';
    const DAI_ADDRESS = '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063';

    const WMATIC_WHALE_ADDRESS = '0xadbf1854e5883eb8aa7baf50705338739e558e5b';

    let WMATIC: IERC20;
    let DAI: IERC20;

    let zrxAPIResponse: QuoteResponse;

    const AMOUNT_IN = utils.parseEther('1000');

    before(async () => {
      strategy = await wallet.generateRandom();

      await evm.reset({
        jsonRpcUrl: getNodeUrl('polygon'),
      });

      zrxAPIResponse = await zrx.quote({
        chainId: CHAIN_ID,
        sellToken: WMATIC_ADDRESS,
        buyToken: DAI_ADDRESS,
        sellAmount: AMOUNT_IN,
        slippagePercentage: 0.05,
      });

      ({
        fromToken: WMATIC,
        toToken: DAI,
        yMech,
        tradeFactory,
        swapper,
      } = await setup.async({
        chainId: CHAIN_ID,
        fixture: ['Common', 'ZRX'],
        swapper: 'ZRX',
        fromTokenAddress: WMATIC_ADDRESS,
        toTokenAddress: DAI_ADDRESS,
        fromTokenWhaleAddress: WMATIC_WHALE_ADDRESS,
        amountIn: AMOUNT_IN,
        strategy,
      }));

      snapshotId = await evm.snapshot.take();
    });

    beforeEach(async () => {
      await evm.snapshot.revert(snapshotId);
    });

    describe('swap', () => {
      beforeEach(async () => {
        await tradeFactory
          .connect(yMech)
          ['execute(uint256,address,uint256,bytes)'](1, swapper.address, zrxAPIResponse.minAmountOut!, zrxAPIResponse.data);
      });

      then('WMATIC gets taken from strategy and DAI gets airdropped to strategy', async () => {
        expect(await WMATIC.balanceOf(strategy.address)).to.equal(0);
      });

      then('DAI gets airdropped to strategy', async () => {
        expect(await DAI.balanceOf(strategy.address)).to.be.gt(0);
      });
    });
  });
}).retries(5);
