// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../interfaces/keep3rV2/IKeep3rHelper.sol';
import '../interfaces/keep3rV2/IKeep3r.sol';

abstract contract Keep3r {
  IKeep3r internal _Keep3r;
  address public bond;
  uint256 public minBond;
  uint256 public earned;
  uint256 public age;
  bool public onlyEOA;
  address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

  event Keep3rSet(address _keep3r);

  event Keep3rRequirementsSet(address _bond, uint256 _minBond, uint256 _earned, uint256 _age, bool _onlyEOA);

  constructor(address _keep3r) {
    _setKeep3r(_keep3r);
  }

  // Setters
  function _setKeep3r(address _keep3r) internal {
    _Keep3r = IKeep3r(_keep3r);
    emit Keep3rSet(_keep3r);
  }

  function _setKeep3rRequirements(
    address _bond,
    uint256 _minBond,
    uint256 _earned,
    uint256 _age,
    bool _onlyEOA
  ) internal {
    bond = _bond;
    minBond = _minBond;
    earned = _earned;
    age = _age;
    onlyEOA = _onlyEOA;
    emit Keep3rRequirementsSet(_bond, _minBond, _earned, _age, _onlyEOA);
  }

  // Modifiers
  // Only checks if caller is a valid keeper, payment should be handled manually
  modifier onlyKeeper(address _keeper) {
    _isKeeper(_keeper);
    _;
  }

  // view
  function keep3r() external view returns (address _keep3r) {
    return address(_Keep3r);
  }

  // handles default payment after execution
  modifier paysKeeper(address _keeper) {
    _;
    _paysKeeper(_keeper);
  }

  // Internal helpers
  function _isKeeper(address _keeper) internal {
    if (onlyEOA) require(_keeper == tx.origin, 'keep3r::isKeeper:keeper-is-not-eoa');
    if (minBond == 0 && earned == 0 && age == 0) {
      // If no custom keeper requirements are set, just evaluate if sender is a registered keeper
      require(_Keep3r.isKeeper(_keeper), 'keep3r::isKeeper:keeper-is-not-registered');
    } else {
      if (bond == address(0)) {
        // Checks for min KP3R, earned and age.
        address kp3r = IKeep3rHelper(_Keep3r.keep3rHelper()).KP3R();
        require(_Keep3r.isBondedKeeper(_keeper, kp3r, minBond, earned, age), 'keep3r::isKeeper:keeper-not-min-requirements');
      } else {
        // Checks for min custom-bond, earned and age.
        require(_Keep3r.isBondedKeeper(_keeper, bond, minBond, earned, age), 'keep3r::isKeeper:keeper-not-custom-min-requirements');
      }
    }
  }

  function _getQuoteLimitFor(address _for, uint256 _initialGas) internal view returns (uint256 _credits) {
    return IKeep3rHelper(_Keep3r.keep3rHelper()).getRewardAmountFor(_for, _initialGas - gasleft());
  }

  // pays in bonded KP3R after execution
  function _paysKeeper(address _keeper) internal {
    _Keep3r.worked(_keeper);
  }

  // pays _amount in bonded KP3R after execution
  function _paysKeeperAmount(address _keeper, uint256 _amount) internal {
    _Keep3r.bondedPayment(_keeper, _amount);
  }

  // pays _amount in ETH after execution
  function _paysKeeperEth(address _keeper, uint256 _amount) internal {
    _Keep3r.directTokenPayment(WETH, _keeper, _amount);
  }
}
