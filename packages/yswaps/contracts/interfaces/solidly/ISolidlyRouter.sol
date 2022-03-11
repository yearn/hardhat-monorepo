// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

interface ISolidlyRouter {
  struct route {
    address from;
    address to;
    bool stable;
  }

  function factory() external view returns (address);

  function pairFor(
    address tokenA,
    address tokenB,
    bool stable
  ) external view returns (address pair);

  function getAmountsOut(uint256, route[] memory) external view returns (uint256[] memory amounts);

  function swapExactTokensForTokensSimple(
    uint256 amountIn,
    uint256 amountOutMin,
    address tokenFrom,
    address tokenTo,
    bool stable,
    address to,
    uint256 deadline
  ) external returns (uint256[] memory);

  function swapExactTokensForTokens(
    uint256 amountIn,
    uint256 amountOutMin,
    route[] calldata routes,
    address to,
    uint256 deadline
  ) external returns (uint256[] memory amounts);
}
