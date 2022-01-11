// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import './TradeFactorySwapperHandler.sol';

import {ISwapperEnabled} from '../utils/ISwapperEnabled.sol';

interface ITradeFactoryPositionsHandler {
  struct TradeDetail {
    address _strategy;
    address _tokenIn;
    address _tokenOut;
  }

  event TradeCreated(address indexed _strategy, address indexed _tokenIn, address indexed _tokenOut);

  event TradeCanceled(address indexed _strategy, address indexed _tokenIn, address indexed _tokenOut);

  error InvalidTrade();

  error AllowanceShouldBeZero();

  function tradeDetails() external view returns (TradeDetail[] memory _tradeDetailsList);

  function create(address _tokenIn, address _tokenOut) external returns (bool _success);

  function cancel(address _tokenIn, address _tokenOut) external returns (bool _success);

  function cancelByAdmin(
    address _strategy,
    address _tokenIn,
    address _tokenOut
  ) external returns (bool _success);
}

abstract contract TradeFactoryPositionsHandler is ITradeFactoryPositionsHandler, TradeFactorySwapperHandler {
  using EnumerableSet for EnumerableSet.AddressSet;

  bytes32 public constant STRATEGY = keccak256('STRATEGY');
  bytes32 public constant STRATEGY_ADDER = keccak256('STRATEGY_ADDER');
  bytes32 public constant TRADES_MODIFIER = keccak256('TRADES_MODIFIER');

  EnumerableSet.AddressSet internal _strategies;

  // strategy -> tokenIn[]
  mapping(address => EnumerableSet.AddressSet) internal _tokensInByStrategy;

  // strategy -> tokenIn -> tokenOut[]
  mapping(address => mapping(address => EnumerableSet.AddressSet)) internal _tokenOutsByStrategyAndTokenIn;

  // strategy -> tokenIn -> amount (is this needed?) [useful for multi in to out]
  // might be needed if tokenIn is also want? or startegy has more balance on tokenIn than what it's supposed to swap [i.e. rebalancer]
  // mapping(address => mapping(address => uint256)) internal _strategyTokenInAmount;

  constructor(address _strategyAdder) {
    if (_strategyAdder == address(0)) revert CommonErrors.ZeroAddress();
    _setRoleAdmin(STRATEGY, STRATEGY_ADDER);
    _setRoleAdmin(STRATEGY_ADDER, MASTER_ADMIN);
    _setupRole(STRATEGY_ADDER, _strategyAdder);
  }

  function tradeDetails() external view override returns (TradeDetail[] memory _tradeDetailsList) {
    uint256 _tradeAmount;
    for (uint256 i; i < _strategies.values().length; i++) {
      address _strategy = _strategies.at(i);
      address[] memory _tokensIn = _tokensInByStrategy[_strategy].values();
      for (uint256 j; j < _tokensIn.length; j++) {
        address _tokenIn = _tokensIn[j];
        address[] memory _tokensOut = _tokenOutsByStrategyAndTokenIn[_strategy][_tokenIn].values();
        _tradeAmount += _tokensOut.length;
      }
    }
    _tradeDetailsList = new TradeDetail[](_tradeAmount);
    uint256 _tradeDetailsIndex;
    for (uint256 i; i < _strategies.values().length; i++) {
      address _strategy = _strategies.at(i);
      address[] memory _tokensIn = _tokensInByStrategy[_strategy].values();
      for (uint256 j; j < _tokensIn.length; j++) {
        address _tokenIn = _tokensIn[j];
        address[] memory _tokensOut = _tokenOutsByStrategyAndTokenIn[_strategy][_tokenIn].values();
        for (uint256 k; k < _tokensOut.length; k++) {
          address _tokenOut = _tokensOut[k];
          _tradeDetailsList[_tradeDetailsIndex] = TradeDetail(_strategy, _tokenIn, _tokenOut);
          _tradeDetailsIndex++;
        }
      }
    }
  }

  function create(address _tokenIn, address _tokenOut) external override onlyRole(STRATEGY) returns (bool _success) {
    if (_tokenIn == address(0) || _tokenOut == address(0)) revert CommonErrors.ZeroAddress();
    _strategies.add(msg.sender);
    _tokensInByStrategy[msg.sender].add(_tokenIn);
    if (!_tokenOutsByStrategyAndTokenIn[msg.sender][_tokenIn].add(_tokenOut)) revert InvalidTrade();
    emit TradeCreated(msg.sender, _tokenIn, _tokenOut);
    return true;
  }

  function cancel(address _tokenIn, address _tokenOut) external override onlyRole(STRATEGY) returns (bool _success) {
    _cancel(msg.sender, _tokenIn, _tokenOut);
    // TODO check for 0 allowance?
    if (IERC20(_tokenIn).allowance(msg.sender, address(this)) != 0) revert AllowanceShouldBeZero();
    return true;
  }

  function cancelByAdmin(
    address _strategy,
    address _tokenIn,
    address _tokenOut
  ) external override onlyRole(STRATEGY) returns (bool _success) {
    // is a callback onlyTradeFactory on swapper enabled better?
    // cancelByAdmin -> strategy.cancelTradeCallback() -> tradeFactory.cancel()
    return ISwapperEnabled(_strategy).cancelTradeCallback(_tokenIn, _tokenOut);
  }

  function _cancel(
    address _strategy,
    address _tokenIn,
    address _tokenOut
  ) internal {
    if (_tokenIn == address(0) || _tokenOut == address(0)) revert CommonErrors.ZeroAddress();
    if (!_tokenOutsByStrategyAndTokenIn[_strategy][_tokenIn].remove(_tokenOut)) revert InvalidTrade();
    if (_tokenOutsByStrategyAndTokenIn[_strategy][_tokenIn].length() == 0) {
      _tokensInByStrategy[_strategy].remove(_tokenIn);
      if (_tokensInByStrategy[_strategy].length() == 0) {
        _strategies.remove(_strategy);
      }
    }
    emit TradeCanceled(_strategy, _tokenIn, _tokenOut);
  }
}
