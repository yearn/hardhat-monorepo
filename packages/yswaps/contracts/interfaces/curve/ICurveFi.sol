// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

interface ICurveFi {
  function calc_withdraw_one_coin(uint256, int128) external view returns (uint256);

  function remove_liquidity_one_coin(
    uint256,
    int128,
    uint256
  ) external;

  function add_liquidity(
    uint256[] calldata,
    uint256,
    bool,
    address
  ) external payable;

}
