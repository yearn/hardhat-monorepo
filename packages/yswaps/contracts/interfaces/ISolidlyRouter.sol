// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

interface ISolidlyRouter {
  struct route {
    address from;
    address to;
    bool stable;
  }

  function getAmountsOut(uint256, route[] memory) external view returns (uint256[] memory amounts);

  function swapExactTokensForTokensSimple(
    uint256,
    uint256,
    address,
    address,
    bool,
    address,
    uint256
  ) external returns (uint256[] memory);

  function swapExactTokensForTokens(
    uint256,
    uint256,
    route[] calldata,
    address,
    uint256
  ) external returns (uint256[] memory amounts);
}
