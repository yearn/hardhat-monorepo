// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../Swapper.sol';

interface IAsyncSwapper is ISwapper {
  event Swapped(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _minAmountOut,
    uint256 _receivedAmount,
    bytes _data
  );

  error InvalidAmountOut();

  function swap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _minAmountOut,
    bytes calldata _data
  ) external returns (uint256 _receivedAmount);
}

abstract contract AsyncSwapper is IAsyncSwapper, Swapper {
  // solhint-disable-next-line var-name-mixedcase
  SwapperType public constant override SWAPPER_TYPE = SwapperType.ASYNC;

  constructor(address _governor, address _tradeFactory) Governable(_governor) Swapper(_tradeFactory) {}

  function _assertPreSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _minAmountOut
  ) internal pure {
    if (_receiver == address(0) || _tokenIn == address(0) || _tokenOut == address(0)) revert CommonErrors.ZeroAddress();
    if (_amountIn == 0) revert CommonErrors.ZeroAmount();
    if (_minAmountOut == 0) revert CommonErrors.ZeroAmount();
  }

  function _executeSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    bytes calldata _data
  ) internal virtual returns (uint256 _receivedAmount);

  function swap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _minAmountOut,
    bytes calldata _data
  ) external virtual override onlyTradeFactory returns (uint256 _receivedAmount) {
    _assertPreSwap(_receiver, _tokenIn, _tokenOut, _amountIn, _minAmountOut);
    uint256 _preExecutionBalance = IERC20(_tokenOut).balanceOf(_receiver);
    _receivedAmount = _executeSwap(_receiver, _tokenIn, _tokenOut, _amountIn, _data);
    if (IERC20(_tokenOut).balanceOf(_receiver) - _preExecutionBalance < _minAmountOut) revert InvalidAmountOut();
    emit Swapped(_receiver, _tokenIn, _tokenOut, _amountIn, _minAmountOut, _receivedAmount, _data);
  }
}
