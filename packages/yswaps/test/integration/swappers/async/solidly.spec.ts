import { expect } from 'chai';
import { BigNumber, utils, Wallet } from 'ethers';
import { JsonRpcSigner } from '@ethersproject/providers';
import { evm, wallet } from '@test-utils';
import { then, when } from '@test-utils/bdd';
import { getNodeUrl } from '@utils/network';
import { IERC20, ISwapper, TradeFactory } from '@typechained';
// import forkBlockNumber from '@integration/fork-block-numbers';
import solidly, { SwapResponse } from '@scripts/libraries/dexes/solidly';
import { WETH, SOLIDLY_ROUTER, SOLIDLY_FACTORY } from '@deploy/fantom-swappers/solidly';
import * as setup from '../setup';

const AMOUNT_IN = utils.parseUnits('100', 6);

describe.only('Solidly', function () {
  let yMech: JsonRpcSigner;
  let strategy: Wallet;
  let tradeFactory: TradeFactory;
  let swapper: ISwapper;

  let USDC: IERC20;
  let WFTM: IERC20;

  let snapshotId: string;

  let solidlyResponse: SwapResponse;

  when('on fantom', () => {
    // const FORK_BLOCK_NUMBER = forkBlockNumber['mainnet-swappers'];

    const CHAIN_ID = 250;

    const USDC_ADDRESS = '0x04068da6c83afcfa0e13ba15a6696662335d5b75';
    const WFTM_ADDRESS = '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83';

    const USDC_WHALE_ADDRESS = '0x93c08a3168fc469f3fc165cd3a471d19a37ca19e';

    before(async () => {
      strategy = await wallet.generateRandom();

      await evm.reset({
        jsonRpcUrl: getNodeUrl('fantom'),
        // blockNumber: FORK_BLOCK_NUMBER,
      });

      ({
        fromToken: USDC,
        toToken: WFTM,
        tradeFactory,
        yMech,
        swapper,
      } = await setup.async({
        chainId: CHAIN_ID,
        fixture: ['Common', 'Fantom', 'Solidly'],
        swapper: 'AsyncSolidly',
        fromTokenAddress: USDC_ADDRESS,
        toTokenAddress: WFTM_ADDRESS,
        fromTokenWhaleAddress: USDC_WHALE_ADDRESS,
        strategy,
      }));

      solidlyResponse = await solidly.getBestPathEncoded({
        tokenIn: USDC_ADDRESS,
        tokenOut: WFTM_ADDRESS,
        amountIn: AMOUNT_IN,
        solidlyRouter: SOLIDLY_ROUTER,
        solidlyFactory: SOLIDLY_FACTORY,
        // hopTokensToTest: [WETH],
        slippage: 3,
      });

      snapshotId = await evm.snapshot.take();
    });

    beforeEach(async () => {
      await evm.snapshot.revert(snapshotId);
    });

    describe('swap', () => {
      let preSwapBalance: BigNumber;
      beforeEach(async () => {
        preSwapBalance = await USDC.balanceOf(strategy.address);
        await tradeFactory.connect(yMech)['execute((address,address,address,uint256,uint256),address,bytes)'](
          {
            _strategy: strategy.address,
            _tokenIn: USDC_ADDRESS,
            _tokenOut: WFTM_ADDRESS,
            _amount: AMOUNT_IN,
            _minAmountOut: solidlyResponse.minAmountOut!,
          },
          swapper.address,
          solidlyResponse.data
        );
      });

      then('USDC gets taken from strategy', async () => {
        expect(await USDC.balanceOf(strategy.address)).to.equal(preSwapBalance.sub(AMOUNT_IN));
      });
      then('WFTM gets airdropped to strategy', async () => {
        expect(await WFTM.balanceOf(strategy.address)).to.be.gt(0);
      });
    });
  });
});
