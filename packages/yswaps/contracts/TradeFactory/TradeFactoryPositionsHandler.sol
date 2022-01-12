// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import './TradeFactorySwapperHandler.sol';

import {ISwapperEnabled} from '../utils/ISwapperEnabled.sol';

interface ITradeFactoryPositionsHandler {
  struct EnabledTrade {
    address _strategy;
    address _tokenIn;
    address _tokenOut;
  }

  event TradeEnabled(address indexed _strategy, address indexed _tokenIn, address indexed _tokenOut);

  event TradeDisabled(address indexed _strategy, address indexed _tokenIn, address indexed _tokenOut);

  error InvalidTrade();

  error AllowanceShouldBeZero();

  function enabledTrades() external view returns (EnabledTrade[] memory _enabledTrades);

  function enable(address _tokenIn, address _tokenOut) external;

  function disable(address _tokenIn, address _tokenOut) external;

  function disableByAdmin(
    address _strategy,
    address _tokenIn,
    address _tokenOut
  ) external;
}

abstract contract TradeFactoryPositionsHandler is ITradeFactoryPositionsHandler, TradeFactorySwapperHandler {
  using EnumerableSet for EnumerableSet.AddressSet;

  bytes32 public constant STRATEGY = keccak256('STRATEGY');
  bytes32 public constant STRATEGY_ADDER = keccak256('STRATEGY_ADDER');

  EnumerableSet.AddressSet internal _strategies;

  // strategy -> tokenIn[]
  mapping(address => EnumerableSet.AddressSet) internal _tokensInByStrategy;

  // strategy -> tokenIn -> tokenOut[]
  mapping(address => mapping(address => EnumerableSet.AddressSet)) internal _tokensOutByStrategyAndTokenIn;

  constructor(address _strategyAdder) {
    if (_strategyAdder == address(0)) revert CommonErrors.ZeroAddress();
    _setRoleAdmin(STRATEGY, STRATEGY_ADDER);
    _setRoleAdmin(STRATEGY_ADDER, MASTER_ADMIN);
    _setupRole(STRATEGY_ADDER, _strategyAdder);
  }

  function enabledTrades() external view override returns (EnabledTrade[] memory _enabledTrades) {
    uint256 _totalEnabledTrades;
    for (uint256 i; i < _strategies.values().length; i++) {
      address _strategy = _strategies.at(i);
      address[] memory _tokensIn = _tokensInByStrategy[_strategy].values();
      for (uint256 j; j < _tokensIn.length; j++) {
        address _tokenIn = _tokensIn[j];
        _totalEnabledTrades += _tokensOutByStrategyAndTokenIn[_strategy][_tokenIn].length();
      }
    }
    _enabledTrades = new EnabledTrade[](_totalEnabledTrades);
    uint256 _enabledTradesIndex;
    for (uint256 i; i < _strategies.values().length; i++) {
      address _strategy = _strategies.at(i);
      address[] memory _tokensIn = _tokensInByStrategy[_strategy].values();
      for (uint256 j; j < _tokensIn.length; j++) {
        address _tokenIn = _tokensIn[j];
        address[] memory _tokensOut = _tokensOutByStrategyAndTokenIn[_strategy][_tokenIn].values();
        for (uint256 k; k < _tokensOut.length; k++) {
          _enabledTrades[_enabledTradesIndex] = EnabledTrade(_strategy, _tokenIn, _tokensOut[k]);
          _enabledTradesIndex++;
        }
      }
    }
  }

  function enable(address _tokenIn, address _tokenOut) external override onlyRole(STRATEGY) {
    if (_tokenIn == address(0) || _tokenOut == address(0)) revert CommonErrors.ZeroAddress();
    _strategies.add(msg.sender);
    _tokensInByStrategy[msg.sender].add(_tokenIn);
    if (!_tokenOutsByStrategyAndTokenIn[msg.sender][_tokenIn].add(_tokenOut)) revert InvalidTrade();
    emit TradeEnabled(msg.sender, _tokenIn, _tokenOut);
  }

  function disable(address _tokenIn, address _tokenOut) external override onlyRole(STRATEGY) {
    _disable(msg.sender, _tokenIn, _tokenOut);
  }

  function disableByAdmin(
    address _strategy,
    address _tokenIn,
    address _tokenOut
  ) external override onlyRole(STRATEGY_ADDER) {
    // strategy.disableTradeCallback() -> tradeFactory.disable()
    ISwapperEnabled(_strategy).disableTradeCallback(_tokenIn, _tokenOut);
  }

  function _disable(
    address _strategy,
    address _tokenIn,
    address _tokenOut
  ) internal {
    if (_tokenIn == address(0) || _tokenOut == address(0)) revert CommonErrors.ZeroAddress();
    if (IERC20(_tokenIn).allowance(msg.sender, address(this)) != 0) revert AllowanceShouldBeZero();
    if (!_tokensOutByStrategyAndTokenIn[_strategy][_tokenIn].remove(_tokenOut)) revert InvalidTrade();
    if (_tokensOutByStrategyAndTokenIn[_strategy][_tokenIn].length() == 0) {
      _tokensInByStrategy[_strategy].remove(_tokenIn);
      if (_tokensInByStrategy[_strategy].length() == 0) {
        _strategies.remove(_strategy);
      }
    }
    emit TradeDisabled(_strategy, _tokenIn, _tokenOut);
  }
}
