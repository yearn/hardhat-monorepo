// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

interface IVault {
  function governance() external view returns (address _governance);

  function withdraw(
    uint256,
    address,
    uint256
  ) external returns (uint256);
}
