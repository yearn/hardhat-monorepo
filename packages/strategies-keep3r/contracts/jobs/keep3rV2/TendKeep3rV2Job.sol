// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import './Keep3rV2PublicJob.sol';

contract TendKeep3rV2Job is Keep3rV2PublicJob {
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
    uint256 _workCooldown,
    address _baseFeeOracle
  )
    Keep3rV2PublicJob(_mechanicsRegistry, _yOracle, _keep3r, _bond, _minBond, _earned, _age, _onlyEOA, _v2Keeper, _workCooldown, _baseFeeOracle)
  // solhint-disable-next-line no-empty-blocks
  {

  }

  function workable(address _strategy) external view override returns (bool) {
    return _workable(_strategy);
  }

  function _workable(address _strategy) internal view override returns (bool) {
    if (!super._workable(_strategy)) return false;
    return IBaseStrategy(_strategy).tendTrigger(_getCallCosts(_strategy));
  }

  function _work(address _strategy) internal override {
    lastWorkAt[_strategy] = block.timestamp;
    IV2Keeper(v2Keeper).tend(_strategy);
  }

  // Keep3r actions
  function work(address _strategy) external override notPaused onlyKeeper(msg.sender) returns (uint256 _credits) {
    _credits = _workInternal(_strategy);
    _paysKeeperAmount(msg.sender, _credits);
  }
}
