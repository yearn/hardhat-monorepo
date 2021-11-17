// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IV1Vault {
  function token() external view returns (address);

  function underlying() external view returns (address);

  function name() external view returns (string memory);

  function symbol() external view returns (string memory);

  function decimals() external view returns (uint8);

  function controller() external view returns (address);

  function governance() external view returns (address);

  function getPricePerFullShare() external view returns (uint256);

  function available() external view returns (uint256);

  function earn() external;
}
