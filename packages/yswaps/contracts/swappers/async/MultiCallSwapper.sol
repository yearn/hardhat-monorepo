// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../../libraries/MultiSendCallOnly.sol';
import './AsyncSwapper.sol';

interface IMultiCallSwapper is IAsyncSwapper {
  error MultiCallRevert();

  // solhint-disable-next-line func-name-mixedcase
  function MULTI_SEND_CALL_ONLY() external view returns (address);
}

contract MultiCallSwapper is IMultiCallSwapper, AsyncSwapper {
  using SafeERC20 for IERC20;

  // solhint-disable-next-line var-name-mixedcase
  address public immutable override MULTI_SEND_CALL_ONLY;

  constructor(
    address _governor,
    address _tradeFactory,
    address _multiSendCallOnly
  ) AsyncSwapper(_governor, _tradeFactory) {
    MULTI_SEND_CALL_ONLY = _multiSendCallOnly;
  }

  function swap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _minAmountOut,
    bytes calldata _data
  ) external override(AsyncSwapper, IAsyncSwapper) onlyTradeFactory returns (uint256 _receivedAmount) {
    _assertPreSwap(_receiver, _tokenIn, _tokenOut, _amountIn, _minAmountOut);
    uint256 _preExecutionBalance = IERC20(_tokenOut).balanceOf(_receiver);

    (bool success, ) = MULTI_SEND_CALL_ONLY.delegatecall(abi.encodeWithSelector(IMultiSendCallOnly.multiSend.selector, _data));

    if (!success) revert MultiCallRevert();

    _receivedAmount = IERC20(_tokenOut).balanceOf(_receiver) - _preExecutionBalance;

    if (_receivedAmount < _minAmountOut) revert InvalidAmountOut();
    emit Swapped(_receiver, _tokenIn, _tokenOut, _amountIn, _minAmountOut, _receivedAmount, _data);
  }

  function _executeSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    bytes calldata _data
  ) internal override returns (uint256 _receivedAmount) {
    // unused
  }
}
