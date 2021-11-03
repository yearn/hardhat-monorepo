import { expect } from 'chai';
import { utils, Wallet } from 'ethers';
import { JsonRpcSigner } from '@ethersproject/providers';
import { evm, wallet } from '@test-utils';
import { then, when } from '@test-utils/bdd';
import { getNodeUrl } from '@utils/network';
import { IERC20, ISwapper, TradeFactory } from '@typechained';
import forkBlockNumber from '@integration/fork-block-numbers';
import bancor, { SwapResponse } from '@scripts/libraries/bancor';
import * as setup from '../setup';

const AMOUNT_IN = utils.parseEther('100');

describe('Bancor', function () {
  let yMech: JsonRpcSigner;
  let strategy: Wallet;
  let tradeFactory: TradeFactory;
  let swapper: ISwapper;

  let MPH: IERC20;
  let DAI: IERC20;

  let snapshotId: string;

  let bancorResponse: SwapResponse;

  when('on mainnet', () => {
    const FORK_BLOCK_NUMBER = forkBlockNumber['mainnet-swappers'];

    const CHAIN_ID = 1;

    const MPH_ADDRESS = '0x8888801af4d980682e47f1a9036e589479e835c5';
    const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f';

    const MPH_WHALE_ADDRESS = '0x1702f18c1173b791900f81ebae59b908da8f689b';

    before(async () => {
      strategy = await wallet.generateRandom();

      await evm.reset({
        jsonRpcUrl: getNodeUrl('mainnet'),
        blockNumber: FORK_BLOCK_NUMBER,
      });

      ({
        fromToken: MPH,
        toToken: DAI,
        tradeFactory,
        yMech,
        swapper,
      } = await setup.async({
        chainId: CHAIN_ID,
        fixture: ['Common', 'Mainnet', 'Bancor'],
        swapper: 'AsyncBancor',
        fromTokenAddress: MPH_ADDRESS,
        toTokenAddress: DAI_ADDRESS,
        fromTokenWhaleAddress: MPH_WHALE_ADDRESS,
        amountIn: AMOUNT_IN,
        strategy,
      }));

      bancorResponse = await bancor.swap({
        tokenIn: MPH_ADDRESS,
        tokenOut: DAI_ADDRESS,
        amountIn: AMOUNT_IN,
        slippage: 3,
      });

      snapshotId = await evm.snapshot.take();
    });

    beforeEach(async () => {
      await evm.snapshot.revert(snapshotId);
    });

    describe('swap', () => {
      beforeEach(async () => {
        await tradeFactory
          .connect(yMech)
          ['execute(uint256,address,uint256,bytes)'](1, swapper.address, bancorResponse.minAmountOut!, bancorResponse.data);
      });

      then('MPH gets taken from strategy', async () => {
        expect(await MPH.balanceOf(strategy.address)).to.equal(0);
      });
      then('DAI gets airdropped to strategy', async () => {
        expect(await DAI.balanceOf(strategy.address)).to.be.gt(0);
      });
    });
  });
});
