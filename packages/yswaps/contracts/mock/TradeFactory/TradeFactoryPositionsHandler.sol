// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../TradeFactory/TradeFactoryPositionsHandler.sol';
import './TradeFactorySwapperHandler.sol';

contract TradeFactoryPositionsHandlerMock is TradeFactorySwapperHandlerMock, TradeFactoryPositionsHandler {
  constructor(
    address _masterAdmin, 
    address _swapperAdder, 
    address _swapperSetter,
    address _strategyAdder,
    address _tradesModifier
  ) 
  TradeFactoryPositionsHandler(
    _strategyAdder,
    _tradesModifier
  ) 
  TradeFactorySwapperHandlerMock(
    _masterAdmin, 
    _swapperAdder, 
    _swapperSetter
  ) {}

  function removePendingTrade(address _strategy, uint256 _id) external {
    _removePendingTrade(_strategy, _id);
  }
}
