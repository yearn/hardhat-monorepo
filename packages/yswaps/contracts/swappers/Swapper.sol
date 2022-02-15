// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '@yearn/contract-utils/contracts/utils/Governable.sol';
import '@yearn/contract-utils/contracts/utils/CollectableDust.sol';

import '../libraries/CommonErrors.sol';

interface ISwapper {
  event TradeFactorySet(address _tradeFactory);

  enum SwapperType {
    ASYNC,
    SYNC
  }

  // solhint-disable-next-line func-name-mixedcase
  function SWAPPER_TYPE() external view returns (SwapperType);

  function tradeFactory() external view returns (address);

  function setTradeFactory(address _tradeFactory) external;
}

abstract contract Swapper is ISwapper, Governable, CollectableDust {
  using SafeERC20 for IERC20;

  // solhint-disable-next-line var-name-mixedcase
  address public override tradeFactory;

  constructor(address _tradeFactory) {
    if (_tradeFactory == address(0)) revert CommonErrors.ZeroAddress();
    tradeFactory = _tradeFactory;
  }

  function setTradeFactory(address _tradeFactory) external override onlyGovernor {
    if (_tradeFactory == address(0)) revert CommonErrors.ZeroAddress();
    tradeFactory = _tradeFactory;
    emit TradeFactorySet(_tradeFactory);
  }

  modifier onlyTradeFactory() {
    if (msg.sender != tradeFactory) revert CommonErrors.NotAuthorized();
    _;
  }

  function sendDust(
    address _to,
    address _token,
    uint256 _amount
  ) external virtual override onlyGovernor {
    _sendDust(_to, _token, _amount);
  }
}
