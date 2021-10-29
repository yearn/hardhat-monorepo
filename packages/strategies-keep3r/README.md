# Strategies Keep3r

## Wishlist

### Strategies

- [x] [`CRV`](./contracts/keep3r/CrvStrategyKeep3r.sol) (`ycrv, busd, sbtc, 3pool, comp`)
- [x] [`DForce`](./contracts/keep3r/DforceStrategyKeep3r.sol) (`usdt, usdc`)
- [ ] (define next strats to keep3rfy)

### Vaults

- [x] [`yearn`](./contracts/keep3r/VaultKeep3r.sol) (`yCrv, busdCrv, sbtcCrv, 3poolCrv, compCrv`)
- [ ] (add more vautls to yearn vault keep3r)
- [ ] (define next vaults types to keep3rfy)

## Scripts

### Get available rewards and workable for CRV (ycrv, busd, sbtc, 3pool, comp) strategies.

`npx hardhat run scripts/crv/01-crv-keep3r-calculate-harvest.js`

### Get available rewards and workable for DForce (sdt, usdc) strategies.

`npx hardhat run scripts/dforce/01-dforce-keep3r-calculate-harvest.js`

### Get available earn and workable for yearn (yCrv, busdCrv, sbtcCrv, 3poolCrv, compCrv) vaults.

`npx hardhat run scripts/vault/01-vault-keep3r-calculate-earn`

## Contracts

---

> keep3r

### [`Keep3rAbstract.sol`](https://github.com/lbertenasco/contract-utils/blob/main/contracts/keep3r/Keep3rAbstract.sol)

Abstract contract that should be used to extend from when creating StrategyKeep3rs (see [`CrvStrategyKeep3r.sol`](./contracts/keep3r/CrvStrategyKeep3r.sol))

```sol
  IKeep3rV1 public keep3r;
  address public bond;
  uint256 public minBond;
  uint256 public earned;
  uint256 public age;
  constructor(address _keep3r) public
  function _setKeep3r(address _keep3r) internal
  function _setKeep3rRequirements(address _bond, uint256 _minBond, uint256 _earned, uint256 _age, bool _onlyEOA) internal
  function _isKeeper() internal
  modifier onlyKeeper()
  modifier paysKeeper()
  modifier paysKeeperAmount(uint256 _amount)
  modifier paysKeeperCredit(address _credit, uint256 _amount)
  modifier paysKeeperEth(uint256 _amount)
```

### [`MetaKeep3r.sol`](./contracts/keep3r/MetaKeep3r.sol)

> TODO

### [`CrvStrategyKeep3r.sol`](./contracts/keep3r/CrvStrategyKeep3r.sol)

> [verified on etherscan](https://etherscan.io/address/0xd0aC37E3524F295D141d3839d5ed5F26A40b589D#code)

Yearn v1 CrvStrategies Keep3r for `ycrv`, `busd`, `sbtc`, `3pool` and `comp` vaults/strats.

```sol
mapping(address => uint256) public requiredHarvest;
function isCrvStrategyKeep3r() external pure override returns (bool) { return true; }
```

Governor (strategist) functions:

```sol
function addStrategy(address _strategy, uint256 _requiredHarvest) external override onlyGovernor;
function updateRequiredHarvestAmount(address _strategy, uint256 _requiredHarvest) external override onlyGovernor;
function removeStrategy(address _strategy) external override onlyGovernor;
function setKeep3r(address _keep3r) external override onlyGovernor;
function setKeep3rRequirements(address _bond, uint256 _minBond, uint256 _earned, uint256 _age, bool _onlyEOA) external override onlyGovernor;
# safeguard that allows governor(strategist) to call harvest directly, not having to go through keep3r network.
function forceHarvest(address _strategy) external override onlyGovernor;
```

Keep3r functions

```sol
# Called externally to get available strategies to do work for
function strategies(address _strategy) public view override returns (address[] memory _strategies);
# Called externally to get available harvest in CRV by strategy
function calculateHarvest(address _strategy) public override returns (uint256 _amount);
# returns true if available harvest is greater or equal than required harvest
function workable(address _strategy) public override returns (bool);
# pays keep3rs to call havest on crv strategies
function harvest(address _strategy) external override onlyKeeper paysKeeper;
```

> call `calculateHarvest` and `workable` functions with `callStatic` to avoid spending gas. (they can be pretty slow too)

### [`DforceStrategyKeep3r.sol`](./contracts/keep3r/DforceStrategyKeep3r.sol)

> [verified on etherscan](https://etherscan.io/address/0x30084324619D9645019C3f2cb3a94611601a3078#code)

> Almost the same functions as `CrvStrategyKeep3r`.

```sol
EnumerableSet.AddressSet internal availableStrategies;
mapping(address => uint256) public requiredHarvest;
function isDforceStrategyKeep3r() external pure override returns (bool) { return true; }
```

Keep3r functions

```sol
# Called externally to get available strategies to do work for
function strategies(address _strategy) public view override returns (address[] memory _strategies);
# Called externally to get available harvest in DForce rewards by strategy
function calculateHarvest(address _strategy) public view override returns (uint256 _amount);
# returns true if available harvest is greater or equal than required harvest
function workable(address _strategy) public view override returns (bool);
# pays keep3rs to call havest on crv strategies
function harvest(address _strategy) external override onlyKeeper paysKeeper;
```

### [`VaultKeep3r.sol`](./contracts/keep3r/VaultKeep3r.sol)

> [verified on etherscan](https://etherscan.io/address/0x054A87DdFdE3ccb5DDB03739375329BcC1b03203#code)

```sol
mapping(address => uint256) public requiredEarn;
mapping(address => uint256) public lastEarnAt;
uint256 earnCooldown;
EnumerableSet.AddressSet internal availableVaults;
function isVaultKeep3r() external pure override returns (bool) { return true; }
```

Governor (strategist) functions:

```sol
function addVault(address _vault, uint256 _requiredEarn)
  external
  override
  onlyGovernor;

function updateRequiredEarnAmount(address _vault, uint256 _requiredEarn)
  external
  override
  onlyGovernor;

function removeVault(address _vault) external override onlyGovernor;

function setEarnCooldown(uint256 _earnCooldown) external override onlyGovernor;

```

Keep3r functions

```sol
# Called externally to get available vaults to do work for
function vaults(address _vault) public view override returns (address[] memory _vaults);
# Called externally to get available earn in yearn by vault
function calculateEarn(address _vault) public view override returns (uint256 _amount);
# returns true if available earn is greater or equal than required earn and earnCooldown has elapsed
function workable(address _vault) public view override returns (bool);
# pays keep3rs to call havest on crv vaults
function earn(address _vault) external override onlyKeeper paysKeeper;
```

---

> mock

### [`MockStrategy.sol`](./contracts/mock/MockStrategy.sol)

> TODO

### [`StrategyCurveYVoterProxyAbstract.sol`](./contracts/mock/StrategyCurveYVoterProxyAbstract.sol)

> TODO

## Adding new StrategyKeep3rs

- you can use [`CrvStrategyKeep3r.sol`](./contracts/keep3r/CrvStrategyKeep3r.sol) as a template

- adapt neccesarry functionality fo fit strategy requirements

- modify `calculateHarvest` function to get your strategy pending rewards correctly

  - it's better to have both `workable` and `calculateHarvest` as `view` functions, `CrvStrategyKeep3r` is not a good example for this.
    - > it's not a view function since it has to call a crv state-modifiyng function to calculate rewards.
    - > check [`CrvStrategyKeep3r-test.js`](./test/CrvStrategyKeep3r-test.js) for details on how to handle calls to non-view `workable` functions.

- make sure you have a `harvest` function that has the `paysKeeper` modifier.
- make sure you have a `forceHarvest` function that has the `onlyGovernor` modifier.

- also take into account that any `onlyStrategist` functions on the strategy will need an `onlyGovernor` proxy function on your keep3r
  - i.e. if the strategy contract has a `configureStrategy(...) onlyStrategist || msg.sender == strategist` you'll need to create a ` configureStrategy(...) onlyGovernor` on your `StrategyKeep3r` contract to keep having access to that method.

## Useful tips for Keep3r Scripts :)

- call `strategies()` function with `callStatic` to get all available strategies, loop through them to check for work.
- always call `workable(address _strategy)` function with `callStatic` to avoid spending gas. (they can be pretty slow too)
- always call `harvest(address _strategy)` function with `callStatic` before sending the real TX to make sure you wont get a revert. (they can be pretty slow too)
- on `VaultKeep3r` use `vaults()` and `earn(address _vault)`
