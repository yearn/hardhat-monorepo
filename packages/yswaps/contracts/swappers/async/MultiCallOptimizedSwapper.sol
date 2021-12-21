// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../../libraries/MultiSendCallOnly.sol';
import './AsyncSwapper.sol';

interface IMultiCallOptimizedSwapper is IAsyncSwapper {
  error MultiCallRevert();
}

contract MultiCallOptimizedSwapper is IMultiCallOptimizedSwapper, AsyncSwapper {
  using SafeERC20 for IERC20;

  constructor(address _governor, address _tradeFactory) AsyncSwapper(_governor, _tradeFactory) {}

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

    bool _success = _multiSendCallNoValue(_data);

    if (!_success) revert MultiCallRevert();

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

  function _multiSendCall(bytes memory transactions) internal returns (bool _success) {
    // solhint-disable-next-line no-inline-assembly
    assembly {
      let length := mload(transactions)
      let i := 0x20
      for {
        // Pre block is not used in "while mode"
      } lt(i, length) {
        // Post block is not used in "while mode"
      } {
        // We shift it right by 96 bits (256 - 160 [20 address bytes]) to right-align the data and zero out unused data.
        let to := shr(0x60, mload(add(transactions, i)))
        // We offset the load address by 20 byte (20 address bytes)
        let value := mload(add(transactions, add(i, 0x14)))
        // We offset the load address by 52 byte (20 address bytes + 32 value bytes)
        let dataLength := mload(add(transactions, add(i, 0x34)))
        // We offset the load address by 84 byte (20 address bytes + 32 value bytes + 32 data length bytes)
        let data := add(transactions, add(i, 0x54))
        _success := call(gas(), to, value, data, dataLength, 0, 0)
        if eq(_success, 0) {
          break
        }

        // Next entry starts at 84 byte + data length
        i := add(i, add(0x54, dataLength))
      }
    }
  }

  function _multiSendCallNoValue(bytes memory transactions) internal returns (bool _success) {
    // solhint-disable-next-line no-inline-assembly
    assembly {
      let length := mload(transactions)
      let i := 0x20
      for {
        // Pre block is not used in "while mode"
      } lt(i, length) {
        // Post block is not used in "while mode"
      } {
        // We shift it right by 96 bits (256 - 160 [20 address bytes]) to right-align the data and zero out unused data.
        let to := shr(0x60, mload(add(transactions, i)))
        // We offset the load address by 20 byte (20 address bytes)
        let dataLength := mload(add(transactions, add(i, 0x14)))
        // We offset the load address by 52 byte (20 address bytes + 32 data length bytes)
        let data := add(transactions, add(i, 0x34))
        _success := call(gas(), to, 0, data, dataLength, 0, 0)
        if eq(_success, 0) {
          break
        }

        // Next entry starts at 52 byte + data length
        i := add(i, add(0x34, dataLength))
      }
    }
  }
}
