// SPDX-License-Identifier: MIT

pragma solidity >=0.8.7 <0.9.0;

import '@yearn/contract-utils/contracts/utils/Governable.sol';

interface IBaseFeeOracle {
  error Unauthorized();
  error NotGovernorOrStrategistsMultisig();
  error NoChange();

  function maxAcceptableBaseFee() external view returns (uint256 _maxAcceptableBaseFee);

  function strategistsMultisig() external view returns (address _strategistsMultisig);

  function authorizedAddresses(address _address) external view returns (bool _authorized);

  function isCurrentBaseFeeAcceptable() external view returns (bool _acceptable);

  function setMaxAcceptableBaseFee(uint256 _maxAcceptableBaseFee) external;
}

contract BaseFeeOracle is Governable, IBaseFeeOracle {
  // Max acceptable base fee for the operation
  uint256 public maxAcceptableBaseFee;

  // SMS is authorized by default
  address public strategistsMultisig;

  // Addresses that can set the max acceptable base fee
  mapping(address => bool) public authorizedAddresses;

  constructor(
    address _governor,
    address _strategistsMultisig,
    uint256 _maxAcceptableBaseFee
  ) Governable(_governor) {
    maxAcceptableBaseFee = _maxAcceptableBaseFee;
    authorizedAddresses[_governor] = true;
    authorizedAddresses[_strategistsMultisig] = true;
  }

  function isCurrentBaseFeeAcceptable() external view returns (bool _acceptable) {
    return block.basefee <= maxAcceptableBaseFee;
  }

  function setMaxAcceptableBaseFee(uint256 _maxAcceptableBaseFee) external {
    if (_maxAcceptableBaseFee == maxAcceptableBaseFee) revert NoChange();
    if (!authorizedAddresses[msg.sender]) revert Unauthorized();
    maxAcceptableBaseFee = _maxAcceptableBaseFee;
  }

  function setAuthorized(address _address) external {
    if (msg.sender == strategistsMultisig || msg.sender == governor) {
      authorizedAddresses[_address] = true;
    } else {
      revert NotGovernorOrStrategistsMultisig();
    }
  }

  function revokeAuthorized(address _address) external {
    if (msg.sender == strategistsMultisig || msg.sender == governor) {
      delete authorizedAddresses[_address];
    } else {
      revert NotGovernorOrStrategistsMultisig();
    }
  }

  function setStrategistsMultisig(address _strategistsMultisig) external {
    if (_strategistsMultisig == strategistsMultisig) revert NoChange();
    if (msg.sender != governor) revert NotGovernor();
    strategistsMultisig = _strategistsMultisig;
  }
}
