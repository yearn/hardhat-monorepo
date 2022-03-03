// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

interface ISolidlyRouter {
  struct route {
        address from;
        address to;
        bool stable;
    }

  function getAmountsOut(uint, route[] memory) external view returns (uint[] memory amounts);

  function swapExactTokensForTokensSimple(
        uint,
        uint,
        address,
        address,
        bool,
        address,
        uint
    ) external returns (uint[] memory);

  function swapExactTokensForTokens(
        uint,
        uint,
        route[] calldata,
        address,
        uint
    ) external returns (uint[] memory amounts);
}
