// SPDX-License-Identifier: MIT

pragma solidity >=0.8.4 <0.9.0;

interface ISwapperEnabled {
  error NotTradeFactory();

  event TradeFactorySet(address indexed _tradeFactory);
  event SwapperSet(string indexed _swapper);

  function tradeFactory() external returns (address _tradeFactory);

  function swapper() external returns (string memory _swapper);

  function setSwapper(string calldata _swapper, bool _migrateSwaps) external;

  function setTradeFactory(address _tradeFactory) external;

  function createTrade(address _tokenIn, address _tokenOut) external returns (bool _success);

  function cancelTrade(address _tokenIn, address _tokenOut) external returns (bool _success);

  function cancelTradeCallback(address _tokenIn, address _tokenOut) external returns (bool _success);

  function executeTrade(address _tokenIn, address _tokenOut) external returns (uint256 _receivedAmount);

  function executeTrade(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    bytes calldata _data
  ) external returns (uint256 _receivedAmount);

  function cancelPendingTrades(uint256[] calldata _pendingTrades) external;
}
