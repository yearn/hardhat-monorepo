// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import './Keep3rV2Job.sol';

abstract contract Keep3rV2PublicJob is Keep3rV2Job {
  constructor(
    address _mechanicsRegistry,
    address _yOracle,
    address _keep3r,
    address _bond,
    uint256 _minBond,
    uint256 _earned,
    uint256 _age,
    bool _onlyEOA,
    address _v2Keeper,
    uint256 _workCooldown
  ) Keep3rV2Job(_mechanicsRegistry, _yOracle, _keep3r, _bond, _minBond, _earned, _age, _onlyEOA, _v2Keeper, _workCooldown) {}

  // Mechanics keeper bypass
  function forceWork(address _strategy) external override onlyGovernorOrMechanic {
    _forceWork(_strategy);
  }
}
