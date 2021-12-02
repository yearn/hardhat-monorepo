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

describe('Uniswap', function () {
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
        fixture: ['Common', 'Mainnet', 'UniswapV2'],
        swapper: 'SyncUniswapV2',
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
