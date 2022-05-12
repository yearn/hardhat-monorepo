// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import './V2Keep3rPublicJob.sol';

import '../../interfaces/jobs/v2/ICalldataV2Keep3rJob.sol';

/* A Keep3r job that requires function calldata from the Keep3r */
contract CalldataV2Keep3rJob is V2Keep3rPublicJob, ICalldataV2Keep3rJob {

  // Get the allowed function selector of a strategy - can't allow the keep3r to call any function they want
  mapping(address => bytes4) public allowedSelector;

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
  )
    V2Keep3rPublicJob(_mechanicsRegistry, _yOracle, _keep3r, _bond, _minBond, _earned, _age, _onlyEOA, _v2Keeper, _workCooldown)
  // solhint-disable-next-line no-empty-blocks
  {

  }

  function updateAllowedSelector(address _strategy, bytes4 _allowedSelector) external override onlyGovernorOrMechanic {
    _updateAllowedSelector(_strategy, _allowedSelector);
  }

  function _updateAllowedSelector(address _strategy, bytes4 _allowedSelector) internal {
    allowedSelector[_strategy] = _allowedSelector;
  }

  function _workInternal(address _strategy, bytes memory _callData) internal returns (uint256 _credits) {
    uint256 _initialGas = gasleft();
    require(_workable(_strategy), 'CalldataV2Keep3rJob::work:not-workable');

    _work(_strategy, _callData);

    _credits = _calculateCredits(_initialGas);

    emit Worked(_strategy, _callData, msg.sender, _credits);
  }

  function workable(address _strategy, bytes calldata _callData) external view override returns (bool) {
    return _workable(_strategy, _callData);
  }

  function _workable(address _strategy, bytes memory _callData) internal view returns (bool) {
    if (!super._workable(_strategy)) return false;

    bytes4 _selector;
    assembly {
      _selector := _callData
    }
    
    return _selector == allowedSelector[_strategy];
  }

  function _work(address _strategy, bytes memory _callData) internal {
    lastWorkAt[_strategy] = block.timestamp;
    IV2Keeper(v2Keeper).execute(_strategy, _callData);
  }

  // Keep3r actions
  function work(address _strategy, bytes calldata _callData) external override notPaused onlyKeeper(msg.sender) returns (uint256 _credits) {
    _credits = _workInternal(_strategy, _callData);
    _paysKeeperAmount(msg.sender, _credits);
  }

  function work(address _strategy) external override returns (uint256 _credits) {}

  function workable(address _strategy) external view override returns (bool) {
    return false;
  }

  // Mechanics keeper bypass
  function forceWork(address _strategy, bytes calldata _callData) external override onlyGovernorOrMechanic {
    _forceWork(_strategy, _callData);
  }

  function _forceWork(address _strategy, bytes memory _callData) internal {
    _work(_strategy, _callData);
    emit ForceWorked(_strategy, _callData);
  }

}
