import { ethers } from 'hardhat';
import { wallet } from '../../../../commons/test-utils';
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
  const randomAddress = await wallet.generateRandomAddress();
  for (const trade of trades) {
    const token = await ethers.getContractAt<IERC20>(IERC20__factory.abi, trade.tokenIn, randomAddress);
    const balance = await token.balanceOf(strategy);
    if (balance.gt(trade.threshold)) executeConfirmations.push(true);
  }

  // Execute only of every  trade should execute.
  if (checkType === 'total') return executeConfirmations.length === trades.length;

  // Execute if at least one trade should execute.
  return !!executeConfirmations.length;
}
