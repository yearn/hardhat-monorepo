// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import './AsyncSwapper.sol';
import '../../interfaces/solidly/ISolidlyRouter.sol';
import 'hardhat/console.sol';

interface ISolidlySwapper is IAsyncSwapper {
  // solhint-disable-next-line func-name-mixedcase
  function ROUTER() external view returns (address);
}

contract SolidlySwapper is ISolidlySwapper, AsyncSwapper {
  using SafeERC20 for IERC20;

  // solhint-disable-next-line var-name-mixedcase
  address public immutable override ROUTER;

  constructor(
    address _governor,
    address _tradeFactory,
    // solhint-disable-next-line var-name-mixedcase
    address _ROUTER
  ) AsyncSwapper(_governor, _tradeFactory) {
    ROUTER = _ROUTER;
  }

  function _executeSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    bytes calldata _data
  ) internal override {
    ISolidlyRouter.route[] memory _path = abi.decode(_data, (ISolidlyRouter.route[]));
    if (_tokenIn != _path[0].from || _tokenOut != _path[_path.length - 1].to) revert CommonErrors.IncorrectSwapInformation();
    IERC20(_path[0].from).approve(ROUTER, 0);
    IERC20(_path[0].from).approve(ROUTER, _amountIn);
    ISolidlyRouter(ROUTER).swapExactTokensForTokens(
      _amountIn,
      0, // Slippage is checked after execution in trade factory
      _path,
      _receiver,
      type(uint256).max
    );
  }
}
