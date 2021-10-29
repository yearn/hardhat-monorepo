// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '@yearn/contract-utils/contracts/utils/Governable.sol';
import '@yearn/contract-utils/contracts/utils/CollectableDust.sol';

import './libraries/CommonErrors.sol';

interface IOTCPool is IGovernable {
  event TradeFactorySet(address indexed _tradeFactory);

  event OfferCreate(address indexed _offeredToken, uint256 _amount);

  event OfferTaken(address indexed _wantedToken, uint256 _amount, address _receiver);

  function tradeFactory() external view returns (address);

  function offers(address) external view returns (uint256);

  function setTradeFactory(address _tradeFactory) external;

  function create(address _offeredToken, uint256 _amount) external;

  function take(
    address _wantedToken,
    uint256 _amount,
    address _receiver
  ) external;
}

contract OTCPool is IOTCPool, CollectableDust, Governable {
  using SafeERC20 for IERC20;

  address public override tradeFactory;

  mapping(address => uint256) public override offers;

  constructor(address _governor, address _tradeFactory) Governable(_governor) {
    if (_tradeFactory == address(0)) revert CommonErrors.ZeroAddress();
    tradeFactory = _tradeFactory;
  }

  modifier onlyTradeFactory() {
    if (msg.sender != tradeFactory) revert CommonErrors.NotAuthorized();
    _;
  }

  function setTradeFactory(address _tradeFactory) external override onlyGovernor {
    if (_tradeFactory == address(0)) revert CommonErrors.ZeroAddress();
    tradeFactory = _tradeFactory;
    emit TradeFactorySet(_tradeFactory);
  }

  function create(address _offeredToken, uint256 _amount) external override onlyGovernor {
    if (_offeredToken == address(0)) revert CommonErrors.ZeroAddress();
    if (_amount == 0) revert CommonErrors.ZeroAmount();
    if (IERC20(_offeredToken).allowance(governor, address(this)) < offers[_offeredToken]) revert CommonErrors.NotAuthorized();
    offers[_offeredToken] += _amount;
    emit OfferCreate(_offeredToken, _amount);
  }

  function take(
    address _wantedToken,
    uint256 _amount,
    address _receiver
  ) external override onlyTradeFactory {
    // No checks more than permission are made, since every argument should be already valid
    IERC20(_wantedToken).safeTransferFrom(governor, _receiver, _amount);
    offers[_wantedToken] -= _amount;
    emit OfferTaken(_wantedToken, _amount, _receiver);
  }

  // CollectableDust
  function sendDust(
    address _to,
    address _token,
    uint256 _amount
  ) external override onlyGovernor {
    _sendDust(_to, _token, _amount);
  }
}
