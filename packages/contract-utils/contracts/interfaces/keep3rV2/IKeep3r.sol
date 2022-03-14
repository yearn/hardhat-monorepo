// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

/// @title Keep3rV2 contract
/// @notice This contract inherits all the functionality of Keep3rV2
interface IKeep3r {
    /// @notice Confirms if the current keeper is registered
    /// @dev Can be used for general (non critical) functions
    /// @param _keeper The keeper being investigated
    /// @return _isKeeper Whether the address passed as a parameter is a keeper or not
    function isKeeper(address _keeper) external returns (bool _isKeeper);

    /// @notice Confirms if the current keeper is registered and has a minimum bond of any asset.
    /// @dev Should be used for protected functions
    /// @param _keeper The keeper to check
    /// @param _bond The bond token being evaluated
    /// @param _minBond The minimum amount of bonded tokens
    /// @param _earned The minimum funds earned in the keepers lifetime
    /// @param _age The minimum keeper age required
    /// @return _isBondedKeeper Whether the `_keeper` meets the given requirements
    function isBondedKeeper(
    address _keeper,
    address _bond,
    uint256 _minBond,
    uint256 _earned,
    uint256 _age
    ) external returns (bool _isBondedKeeper);

    /// @notice Implemented by jobs to show that a keeper performed work
    /// @dev Automatically calculates the payment for the keeper and pays the keeper with bonded KP3R
    /// @param _keeper Address of the keeper that performed the work
    function worked(address _keeper) external;

    /// @notice Implemented by jobs to show that a keeper performed work
    /// @dev Pays the keeper that performs the work with KP3R
    /// @param _keeper Address of the keeper that performed the work
    /// @param _payment The reward that should be allocated for the job
    function bondedPayment(address _keeper, uint256 _payment) external;

    /// @notice Implemented by jobs to show that a keeper performed work
    /// @dev Pays the keeper that performs the work with a specific token
    /// @param _token The asset being awarded to the keeper
    /// @param _keeper Address of the keeper that performed the work
    /// @param _amount The reward that should be allocated
    function directTokenPayment(
    address _token,
    address _keeper,
    uint256 _amount
    ) external;

    /// @notice Address of Keep3rHelper's contract
    /// @return _keep3rHelper The address of Keep3rHelper's contract
    function keep3rHelper() external view returns (address _keep3rHelper);

    /// @notice Allows any caller to add a new job
    /// @param _job Address of the contract for which work should be performed
    function addJob(address _job) external;

    /// @notice Gifts liquidity credits to the specified job
    /// @param _job The address of the job being credited
    /// @param _amount The amount of liquidity credits to gift
    function forceLiquidityCreditsToJob(address _job, uint256 _amount) external;
}
