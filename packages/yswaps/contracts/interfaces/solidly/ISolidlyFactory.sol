// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

interface ISolidlyFactory {
  function allPairsLength() external view returns (uint256);

  function isPair(address pair) external view returns (bool);

  function pairCodeHash() external pure returns (bytes32);

  function getPair(
    address tokenA,
    address token,
    bool stable
  ) external view returns (address);

  function createPair(
    address tokenA,
    address tokenB,
    bool stable
  ) external returns (address pair);
}
