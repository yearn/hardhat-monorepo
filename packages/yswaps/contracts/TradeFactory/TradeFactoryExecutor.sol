// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

import '@yearn/contract-utils/contracts/utils/Machinery.sol';

import '../swappers/async/AsyncSwapper.sol';
import '../swappers/async/MultipleAsyncSwapper.sol';
import '../swappers/sync/SyncSwapper.sol';

import './TradeFactoryPositionsHandler.sol';

interface ITradeFactoryExecutor {
  event SyncTradeExecuted(
    address indexed _strategy,
    address indexed _swapper,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    bytes _data,
    uint256 _receivedAmount
  );

  event AsyncTradeExecuted(
    address indexed _strategy,
    address indexed _tokenIn,
    address indexed _tokenOut,
    address _swapper,
    uint256 _amountIn,
    uint256 _minAmountOut,
    uint256 _receivedAmount
  );

  event AsyncTradesMatched(
    uint256 indexed _firstTradeId,
    uint256 indexed _secondTradeId,
    uint256 _consumedFirstTrade,
    uint256 _consumedSecondTrade
  );

  event SwapperAndTokenEnabled(address indexed _swapper, address _token);

  error ZeroRate();

  error InvalidAmountOut();

  function execute(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    bytes calldata _data
  ) external returns (uint256 _receivedAmount);

  function execute(
    address _strategy,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    address _swapper,
    uint256 _minAmountOut,
    bytes calldata _data
  ) external returns (uint256 _receivedAmount);
}

abstract contract TradeFactoryExecutor is ITradeFactoryExecutor, TradeFactoryPositionsHandler, Machinery {
  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.UintSet;
  using EnumerableSet for EnumerableSet.AddressSet;

  constructor(address _mechanicsRegistry) Machinery(_mechanicsRegistry) {}

  // Machinery
  function setMechanicsRegistry(address __mechanicsRegistry) external virtual override onlyRole(MASTER_ADMIN) {
    _setMechanicsRegistry(__mechanicsRegistry);
  }

  // Execute via sync swapper
  function execute(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    bytes calldata _data
  ) external override onlyRole(STRATEGY) returns (uint256 _receivedAmount) {
    address _swapper = strategySyncSwapper[msg.sender];
    if (_tokenIn == address(0) || _tokenOut == address(0)) revert CommonErrors.ZeroAddress();
    if (_amountIn == 0) revert CommonErrors.ZeroAmount();
    if (_maxSlippage == 0) revert CommonErrors.ZeroSlippage();
    IERC20(_tokenIn).safeTransferFrom(msg.sender, _swapper, _amountIn);
    _receivedAmount = ISyncSwapper(_swapper).swap(msg.sender, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _data);
    emit SyncTradeExecuted(msg.sender, _swapper, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _data, _receivedAmount);
  }

  // Execute via async swapper
  function execute(
    address _strategy,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    address _swapper,
    uint256 _minAmountOut,
    bytes calldata _data
  ) external override onlyMechanic returns (uint256 _receivedAmount) {
    if (!_tokenOutsByStrategyAndTokenIn[_strategy][_tokenIn].contains(_tokenOut)) revert InvalidTrade();
    if (!_swappers.contains(_swapper)) revert InvalidSwapper();
    if (_amountIn == 0) _amountIn = IERC20(_tokenIn).balanceOf(_strategy);
    IERC20(_tokenIn).safeTransferFrom(_strategy, _swapper, _amountIn);
    uint256 _preExecutionBalanceOut = IERC20(_tokenOut).balanceOf(_strategy);
    _receivedAmount = IAsyncSwapper(_swapper).swap(_strategy, _tokenIn, _tokenOut, _amountIn, _minAmountOut, _data);
    uint256 _receivedAmountOut = IERC20(_tokenOut).balanceOf(_strategy);
    if (_receivedAmountOut - _preExecutionBalanceOut < _minAmountOut) revert InvalidAmountOut();
    emit AsyncTradeExecuted(_strategy, _tokenIn, _tokenOut, _swapper, _amountIn, _minAmountOut, _receivedAmount);
  }

  struct Trade {
    address _strategy;
    address _tokenIn;
    address _tokenOut;
    uint256 _amountIn;
    uint256 _minAmountOut;
  }

  function executeMultiple(
    Trade[] calldata _trades,
    address _swapper,
    bytes calldata _data // i.e. transaction[] for MulticallSwapper
  ) external onlyMechanic returns (bool _error) {
    // todo check what returns (or no return) saves more gas

    uint256[] memory _preTokenOutBalance = new uint256[](_trades.length);
    if (!_swappers.contains(_swapper)) revert InvalidSwapper();
    for (uint256 i; i < _trades.length; i++) {
      if (!_tokenOutsByStrategyAndTokenIn[_trades[i]._strategy][_trades[i]._tokenIn].contains(_trades[i]._tokenOut)) revert InvalidTrade();
      uint256 _amountIn = _trades[i]._amountIn != 0 ? _trades[i]._amountIn : IERC20(_trades[i]._tokenIn).balanceOf(_trades[i]._strategy);
      IERC20(_trades[i]._tokenIn).safeTransferFrom(_trades[i]._strategy, _swapper, _amountIn);
      _preTokenOutBalance[i] = IERC20(_trades[i]._tokenOut).balanceOf(_trades[i]._strategy);
    }

    IMultipleAsyncSwapper(_swapper).swapMultiple(_data);

    for (uint256 i; i < _trades.length; i++) {
      if (_trades[i]._minAmountOut < IERC20(_trades[i]._tokenOut).balanceOf(_trades[i]._strategy) - _preTokenOutBalance[i])
        revert InvalidAmountOut();
    }

    // emit AsyncTradeExecuted(_strategy, _tokenIn, _tokenOut, _swapper, _amountIn, _minAmountOut, _receivedAmount);
    return false;
  }
}
