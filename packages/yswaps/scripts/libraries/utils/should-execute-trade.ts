import { utils } from 'ethers';
import { ethers } from 'hardhat';
import { IERC20Metadata, IERC20Metadata__factory } from '../../../typechained';
import { SimpleEnabledTrade } from '../types';

export async function shouldExecuteTrade({ strategy, trade }: { strategy: string; trade: SimpleEnabledTrade }): Promise<boolean> {
  const token = await ethers.getContractAt<IERC20Metadata>(IERC20Metadata__factory.abi, trade.tokenIn);
  const [balance, decimals] = await Promise.all([token.balanceOf(strategy), token.decimals()]);
  if (balance.gt(trade.threshold)) return true;
  else {
    console.log(
      `[Should Execute] Token ${await token.symbol()} should NOT execute. Balance: ${utils.formatUnits(
        balance,
        decimals
      )} - Threshold ${utils.formatUnits(trade.threshold, decimals)}`
    );
    return false;
  }
}
