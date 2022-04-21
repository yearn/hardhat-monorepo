// SPDX-License-Identifier: MIT
pragma solidity >=0.6.8;

import './IV2Keep3rJob.sol';

interface ICalldataV2Keep3rJob is IKeep3rJob {

  // Actions by Keeper
  event Worked(address _strategy, bytes _callData, address _keeper, uint256 _credits);

  // Actions forced by governor
  event ForceWorked(address _strategy, bytes _callData);

  function updateAllowedSelector(address _strategy, bytes4 _allowedSelector) external;

  function workable(address _strategy, bytes calldata _callData) external view returns (bool);

  // Keeper actions
  function work(address _strategy, bytes calldata _callData) external returns (uint256 _credits);

  // Mechanics keeper bypass
  function forceWork(address _strategy, bytes calldata _callData) external;

}
