import { expect } from 'chai';
import { utils, Wallet } from 'ethers';
import { ethers } from 'hardhat';
import { evm, wallet } from '@test-utils';
import { then, when } from '@test-utils/bdd';
import { getNodeUrl } from '@utils/network';
import { IERC20, TradeFactory } from '@typechained';
import forkBlockNumber from '@integration/fork-block-numbers';
import * as setup from '../setup';

const MAX_SLIPPAGE = 10_000; // 1%
const AMOUNT_IN = utils.parseEther('10000');

describe('Sushiswap', function () {
  let strategy: Wallet;
  let tradeFactory: TradeFactory;

  let CRV: IERC20;
  let DAI: IERC20;

  let snapshotId: string;

  when('on mainnet', () => {
    const FORK_BLOCK_NUMBER = forkBlockNumber['mainnet-swappers'];

    const CHAIN_ID = 1;

    const CRV_ADDRESS = '0xD533a949740bb3306d119CC777fa900bA034cd52';
    const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f';

    const CRV_WHALE_ADDRESS = '0xd2d43555134dc575bf7279f4ba18809645db0f1d';

    before(async () => {
      strategy = await wallet.generateRandom();

      await evm.reset({
        jsonRpcUrl: getNodeUrl('mainnet'),
        blockNumber: FORK_BLOCK_NUMBER,
      });

      ({
        fromToken: CRV,
        toToken: DAI,
        tradeFactory,
      } = await setup.sync({
        chainId: CHAIN_ID,
        fixture: ['Common', 'Mainnet', 'Sushiswap'],
        swapper: 'SyncSushiswap',
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
      const data = ethers.utils.defaultAbiCoder.encode([], []);
      beforeEach(async () => {
        await tradeFactory
          .connect(strategy)
          ['execute(address,address,uint256,uint256,bytes)'](CRV_ADDRESS, DAI_ADDRESS, AMOUNT_IN, MAX_SLIPPAGE, data);
      });

      then('CRV gets taken from strategy', async () => {
        expect(await CRV.balanceOf(strategy.address)).to.equal(0);
      });
      then('DAI gets airdropped to strategy', async () => {
        expect(await DAI.balanceOf(strategy.address)).to.be.gt(0);
      });
    });
  });

  when('on polygon', () => {
    const FORK_BLOCK_NUMBER = forkBlockNumber['polygon-swappers'];

    const CHAIN_ID = 137;

    const CRV_ADDRESS = '0x172370d5cd63279efa6d502dab29171933a610af';
    const DAI_ADDRESS = '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063';

    const CRV_WHALE_ADDRESS = '0x3a8a6831a1e866c64bc07c3df0f7b79ac9ef2fa2';

    before(async () => {
      strategy = await wallet.generateRandom();

      await evm.reset({
        jsonRpcUrl: getNodeUrl('polygon'),
        blockNumber: FORK_BLOCK_NUMBER,
      });

      ({
        fromToken: CRV,
        toToken: DAI,
        tradeFactory,
      } = await setup.sync({
        chainId: CHAIN_ID,
        fixture: ['Common', 'Polygon', 'SyncSushiswap'],
        swapper: 'SyncSushiswap',
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
      const data = ethers.utils.defaultAbiCoder.encode([], []);
      beforeEach(async () => {
        await tradeFactory
          .connect(strategy)
          ['execute(address,address,uint256,uint256,bytes)'](CRV_ADDRESS, DAI_ADDRESS, AMOUNT_IN, MAX_SLIPPAGE, data);
      });

      then('CRV gets taken from strategy', async () => {
        expect(await CRV.balanceOf(strategy.address)).to.equal(0);
      });
      then('DAI gets airdropped to strategy', async () => {
        expect(await DAI.balanceOf(strategy.address)).to.be.gt(0);
      });
    });
  });
});
