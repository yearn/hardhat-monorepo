// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

import '@yearn/contract-utils/contracts/utils/Machinery.sol';

import '../swappers/async/AsyncSwapper.sol';
import '../swappers/sync/SyncSwapper.sol';

import '../OTCPool.sol';

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

  event AsyncTradeExecuted(uint256 indexed _id, uint256 _receivedAmount);

  event AsyncTradesMatched(
    uint256 indexed _firstTradeId,
    uint256 indexed _secondTradeId,
    uint256 _consumedFirstTrade,
    uint256 _consumedSecondTrade
  );

  event AsyncOTCTradesExecuted(uint256[] _ids, uint256 _rateTokenInToOut);

  event AsyncTradeExpired(uint256 indexed _id);

  event SwapperAndTokenEnabled(address indexed _swapper, address _token);

  error OngoingTrade();

  error ExpiredTrade();

  error ZeroRate();

  function execute(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    bytes calldata _data
  ) external returns (uint256 _receivedAmount);

  function execute(
    uint256 _id,
    address _swapper,
    uint256 _minAmountOut,
    bytes calldata _data
  ) external returns (uint256 _receivedAmount);

  function expire(uint256 _id) external returns (uint256 _freedAmount);

  function execute(uint256[] calldata _ids, uint256 _rateTokenInToOut) external;

  function execute(
    uint256 _firstTradeId,
    uint256 _secondTradeId,
    uint256 _consumedFirstTrade,
    uint256 _consumedSecondTrade
  ) external;
}

abstract contract TradeFactoryExecutor is ITradeFactoryExecutor, TradeFactoryPositionsHandler, Machinery {
  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.UintSet;
  using EnumerableSet for EnumerableSet.AddressSet;

  bytes32 public constant TRADES_SETTLER = keccak256('TRADES_SETTLER');

  constructor(address _tradesSettler, address _mechanicsRegistry) Machinery(_mechanicsRegistry) {
    _setRoleAdmin(TRADES_SETTLER, MASTER_ADMIN);
    _setupRole(TRADES_SETTLER, _tradesSettler);
  }

  // Machinery
  function setMechanicsRegistry(address _mechanicsRegistry) external virtual override onlyRole(MASTER_ADMIN) {
    _setMechanicsRegistry(_mechanicsRegistry);
  }

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

  // TradeFactoryExecutor
  function execute(
    uint256 _id,
    address _swapper,
    uint256 _minAmountOut,
    bytes calldata _data
  ) external override onlyMechanic returns (uint256 _receivedAmount) {
    if (!_pendingTradesIds.contains(_id)) revert InvalidTrade();
    Trade storage _trade = pendingTradesById[_id];
    if (block.timestamp > _trade._deadline) revert ExpiredTrade();
    if (!_swappers.contains(_swapper)) revert InvalidSwapper();
    IERC20(_trade._tokenIn).safeTransferFrom(_trade._strategy, _swapper, _trade._amountIn);
    _receivedAmount = IAsyncSwapper(_swapper).swap(_trade._strategy, _trade._tokenIn, _trade._tokenOut, _trade._amountIn, _minAmountOut, _data);
    _removePendingTrade(_trade._strategy, _id);
    emit AsyncTradeExecuted(_id, _receivedAmount);
  }

  function expire(uint256 _id) external override onlyMechanic returns (uint256 _freedAmount) {
    if (!_pendingTradesIds.contains(_id)) revert InvalidTrade();
    Trade storage _trade = pendingTradesById[_id];
    if (block.timestamp < _trade._deadline) revert OngoingTrade();
    _freedAmount = _trade._amountIn;
    // We have to take tokens from strategy, to decrease the allowance
    IERC20(_trade._tokenIn).safeTransferFrom(_trade._strategy, address(this), _trade._amountIn);
    // Send tokens back to strategy
    IERC20(_trade._tokenIn).safeTransfer(_trade._strategy, _trade._amountIn);
    // Remove trade
    _removePendingTrade(_trade._strategy, _id);
    emit AsyncTradeExpired(_id);
  }

  function execute(uint256[] calldata _ids, uint256 _rateTokenInToOut) external override onlyMechanic {
    if (_rateTokenInToOut == 0) revert ZeroRate();
    address _tokenIn = pendingTradesById[_ids[0]]._tokenIn;
    address _tokenOut = pendingTradesById[_ids[0]]._tokenOut;
    uint256 _magnitudeIn = 10**IERC20Metadata(_tokenIn).decimals();
    for (uint256 i; i < _ids.length; i++) {
      Trade storage _trade = pendingTradesById[_ids[i]];
      if (i > 0 && (_trade._tokenIn != _tokenIn || _trade._tokenOut != _tokenOut)) revert InvalidTrade();
      if (block.timestamp > _trade._deadline) revert ExpiredTrade();
      if ((strategyPermissions[_trade._strategy] & _OTC_MASK) != _OTC_MASK) revert CommonErrors.NotAuthorized();
      uint256 _consumedOut = (_trade._amountIn * _rateTokenInToOut) / _magnitudeIn;
      IERC20(_trade._tokenIn).safeTransferFrom(_trade._strategy, IOTCPool(otcPool).governor(), _trade._amountIn);
      IOTCPool(otcPool).take(_trade._tokenOut, _consumedOut, _trade._strategy);
      _removePendingTrade(_trade._strategy, _trade._id);
    }
    emit AsyncOTCTradesExecuted(_ids, _rateTokenInToOut);
  }

  function execute(
    uint256 _firstTradeId,
    uint256 _secondTradeId,
    uint256 _consumedFirstTrade,
    uint256 _consumedSecondTrade
  ) external override onlyRole(TRADES_SETTLER) {
    Trade storage _firstTrade = pendingTradesById[_firstTradeId];
    Trade storage _secondTrade = pendingTradesById[_secondTradeId];
    if (_firstTrade._tokenIn != _secondTrade._tokenOut || _firstTrade._tokenOut != _secondTrade._tokenIn) revert InvalidTrade();
    if (block.timestamp > _firstTrade._deadline || block.timestamp > _secondTrade._deadline) revert ExpiredTrade();
    if (
      (strategyPermissions[_firstTrade._strategy] & _COW_MASK) != _COW_MASK ||
      (strategyPermissions[_secondTrade._strategy] & _COW_MASK) != _COW_MASK
    ) revert CommonErrors.NotAuthorized();

    IERC20(_firstTrade._tokenIn).safeTransferFrom(_firstTrade._strategy, _secondTrade._strategy, _consumedFirstTrade);
    IERC20(_secondTrade._tokenIn).safeTransferFrom(_secondTrade._strategy, _firstTrade._strategy, _consumedSecondTrade);

    if (_consumedFirstTrade != _firstTrade._amountIn) {
      _firstTrade._amountIn -= _consumedFirstTrade;
    } else {
      _removePendingTrade(_firstTrade._strategy, _firstTradeId);
    }

    if (_consumedSecondTrade != _secondTrade._amountIn) {
      _secondTrade._amountIn -= _consumedSecondTrade;
    } else {
      _removePendingTrade(_secondTrade._strategy, _secondTradeId);
    }

    emit AsyncTradesMatched(_firstTradeId, _secondTradeId, _consumedFirstTrade, _consumedSecondTrade);
  }
}
