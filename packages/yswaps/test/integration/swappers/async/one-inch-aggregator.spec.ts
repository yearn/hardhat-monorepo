import { expect } from 'chai';
import { JsonRpcSigner } from '@ethersproject/providers';
import { utils, Wallet } from 'ethers';
import { evm, wallet } from '@test-utils';
import { then } from '@test-utils/bdd';
import { getNodeUrl } from '@utils/network';
import oneinch, { SwapResponse } from '@scripts/libraries/oneinch';
import { IERC20, ISwapper, TradeFactory } from '@typechained';
import * as setup from '../setup';

describe('OneInchAggregator', function () {
  let yMech: JsonRpcSigner;
  let strategy: Wallet;

  let tradeFactory: TradeFactory;
  let swapper: ISwapper;

  let snapshotId: string;

  const GAS_LIMIT = 1_000_000;

  context('on mainnet', () => {
    const CHAIN_ID = 1;

    const CRV_ADDRESS = '0xD533a949740bb3306d119CC777fa900bA034cd52';
    const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f';

    const CRV_WHALE_ADDRESS = '0xd2d43555134dc575bf7279f4ba18809645db0f1d';

    const AMOUNT_IN = utils.parseEther('10000');

    let CRV: IERC20;
    let DAI: IERC20;

    let oneInchApiResponse: SwapResponse;

    before(async () => {
      strategy = await wallet.generateRandom();

      await evm.reset({
        jsonRpcUrl: getNodeUrl('mainnet'),
      });

      // We get information for trade first, 1inch API starts returning non-valid data

      oneInchApiResponse = await oneinch.swap(CHAIN_ID, {
        tokenIn: CRV_ADDRESS,
        tokenOut: DAI_ADDRESS,
        amountIn: AMOUNT_IN,
        fromAddress: wallet.generateRandomAddress(),
        receiver: strategy.address,
        slippage: 3,
        allowPartialFill: false,
        disableEstimate: true,
        fee: 0,
        gasLimit: GAS_LIMIT,
      });

      ({
        fromToken: CRV,
        toToken: DAI,
        yMech,
        tradeFactory,
        swapper,
      } = await setup.async({
        chainId: CHAIN_ID,
        fixture: ['Common', 'OneInchAggregator'],
        swapper: 'OneInchAggregator',
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
          ['execute(uint256,address,uint256,bytes)'](1, swapper.address, oneInchApiResponse.minAmountOut!, oneInchApiResponse.tx.data, {
            gasLimit: GAS_LIMIT + GAS_LIMIT * 0.25,
          });
      });

      then('CRV gets taken from strategy', async () => {
        expect(await CRV.balanceOf(strategy.address)).to.equal(0);
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

    const AMOUNT_IN = utils.parseEther('1000');
    let oneInchApiResponse: SwapResponse;

    before(async () => {
      strategy = await wallet.generateRandom();

      await evm.reset({
        jsonRpcUrl: getNodeUrl('polygon'),
      });

      // We get information for trade first, 1inch API starts returning non-valid data

      oneInchApiResponse = await oneinch.swap(CHAIN_ID, {
        tokenIn: WMATIC_ADDRESS,
        tokenOut: DAI_ADDRESS,
        amountIn: AMOUNT_IN,
        fromAddress: wallet.generateRandomAddress(),
        receiver: strategy.address,
        slippage: 5,
        allowPartialFill: false,
        disableEstimate: true,
        fee: 0,
        gasLimit: GAS_LIMIT,
      });

      ({
        fromToken: WMATIC,
        toToken: DAI,
        yMech,
        tradeFactory,
        swapper,
      } = await setup.async({
        chainId: CHAIN_ID,
        fixture: ['Common', 'OneInchAggregator'],
        swapper: 'OneInchAggregator',
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
          ['execute(uint256,address,uint256,bytes)'](1, swapper.address, oneInchApiResponse.minAmountOut!, oneInchApiResponse.tx.data, {
            gasLimit: GAS_LIMIT + GAS_LIMIT * 0.25,
          });
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
