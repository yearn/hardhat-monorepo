import { utils } from 'ethers';
import { ethers } from 'hardhat';
import { IERC20, IERC20__factory } from '../../../typechained';
import { SimpleEnabledTrade } from '../types';

export async function shouldExecuteTrade({
  strategy,
  trade,
}: {
  strategy: string;
  trade: SimpleEnabledTrade;
}): Promise<boolean> {
  const token = await ethers.getContractAt<IERC20>(IERC20__factory.abi, trade.tokenIn);
  const balance = await token.balanceOf(strategy);
  if (balance.gt(trade.threshold)) return true;
  else {
    console.log(
      `[Should Execute] Token ${trade.tokenIn} should NOT execute. Balance: ${utils.formatEther(balance)} - Threshold ${utils.formatEther(
        trade.threshold
      )}`
    );
    return false;
  }
}
