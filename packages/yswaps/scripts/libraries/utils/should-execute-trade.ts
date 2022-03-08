import { utils } from 'ethers';
import { ethers } from 'hardhat';
import { IERC20, IERC20__factory } from '../../../typechained';
import { SimpleEnabledTrade } from '../types';

export async function shouldExecuteTrade({
  strategy,
  trades,
  checkType,
}: {
  strategy: string;
  trades: SimpleEnabledTrade[];
  checkType: 'total' | 'partial';
}): Promise<boolean> {
  const executeConfirmations: boolean[] = [];
  for (const trade of trades) {
    const token = await ethers.getContractAt<IERC20>(IERC20__factory.abi, trade.tokenIn);
    const balance = await token.balanceOf(strategy);
    if (balance.gt(trade.threshold)) executeConfirmations.push(true);
    else {
      console.log(
        `[Should Execute] Token ${trade.tokenIn} should NOT execute. Balance: ${utils.formatEther(balance)} - Threshold ${utils.formatEther(
          trade.threshold
        )}`
      );
    }
  }

  // Execute only of every  trade should execute.
  if (checkType === 'total') return executeConfirmations.length === trades.length;

  // Execute if at least one trade should execute.
  return executeConfirmations.length > 0;
}
