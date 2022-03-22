// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

abstract contract Keep3rBase {

    address public bond;
    uint256 public minBond;
    uint256 public earned;
    uint256 public age;
    bool public onlyEOA;

    event Keep3rSet(address _keep3r);

    event Keep3rRequirementsSet(address _bond, uint256 _minBond, uint256 _earned, uint256 _age, bool _onlyEOA);

    // Setters
    function _setKeep3r(address _keep3r) internal virtual;

    function _setKeep3rRequirements(
        address _bond,
        uint256 _minBond,
        uint256 _earned,
        uint256 _age,
        bool _onlyEOA
    ) internal virtual;

    // Modifiers
    // Only checks if caller is a valid keeper, payment should be handled manually
    modifier onlyKeeper(address _keeper) {
        _isKeeper(_keeper);
        _;
    }

    // handles default payment after execution
    modifier paysKeeper(address _keeper) {
        _;
        _paysKeeper(_keeper);
    }

    // view
    function keep3r() external view virtual returns (address _keep3r);

    // Internal helpers
    function _isKeeper(address _keeper) internal virtual;

    function _getQuoteLimitFor(address _for, uint256 _initialGas) internal view virtual returns (uint256 _credits);

    // pays in bonded KP3R after execution
    function _paysKeeper(address _keeper) internal virtual;

    // pays _amount in bonded KP3R after execution
    function _paysKeeperAmount(address _keeper, uint256 _amount) internal virtual;

    // pays _amount in _credit after execution
    function _paysKeeperCredit(
        address _credit,
        address _keeper,
        uint256 _amount
    ) internal virtual;

    // pays _amount in KP3R after execution
    function _paysKeeperInTokens(address _keeper, uint256 _amount) internal virtual;

    // pays _amount in ETH after execution
    function _paysKeeperEth(address _keeper, uint256 _amount) internal virtual;

}