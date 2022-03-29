// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

// Just a dummy strategy contract to test
contract DummyStrategy {

    uint foo;

    function tendTrigger(uint256 callCostInWei) public view virtual returns (bool) {
        callCostInWei; // shh
        return true;
    }

    function tend() external {
        foo = 1;
    }

    function harvestTrigger(uint256 callCostInWei) public view virtual returns (bool) {
        callCostInWei; // shh
        return true;
    }

    function harvest() external {
        foo = 0;
    }

}