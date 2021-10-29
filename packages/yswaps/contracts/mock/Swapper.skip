// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../Swapper.sol';

contract SwapperMock is Swapper {

  event MyInternalExecuteSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    bytes _data
  );

  event DecodedData(uint256 _decodedData);
  
  constructor(address _governor, address _tradeFactory) Swapper(_governor, _tradeFactory) {}

  function SWAPPER_TYPE() external view override returns (SwapperType) {
    return SwapperType.ASYNC;
  }

  function modifierOnlyTradeFactory() external onlyTradeFactory { }

  function assertPreSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) external pure {
    _assertPreSwap(_receiver, _tokenIn, _tokenOut, _amountIn, _maxSlippage);
  }

  function _decodeData(bytes calldata _data) internal pure returns (uint256) {
    return abi.decode(_data, (uint256));
  }

  function _executeSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    bytes calldata _data
  ) internal override returns (uint256 _receivedAmount) {
    uint256 _decodedData = _decodeData(_data);
    emit DecodedData(_decodedData);
    emit MyInternalExecuteSwap(_receiver, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _data);
    _receivedAmount = 1_000;
  }
}
