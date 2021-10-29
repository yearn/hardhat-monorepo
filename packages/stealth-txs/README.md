# Bonded Stealth TX

> name is not final, all suggestions are welcome

### How does it work

- keeper calls `bond` with `msg.value`
- keeper calls contract with a random `_stealthHash`
- contract uses [`validateStealthTx`](https://github.com/lbertenasco/contract-utils/blob/main/contracts/utils/StealthTx.sol) modifier to `validateHash` with `msg.sender`, `hash` and `penalty`
  - if valid (no one reported it) execution continues.
  - if invalid (hash was reported) `msg.sender` loses it's `bond` and execution stops.

## Improvements:

- update README (how does it work)

- tests

- check remaining gas on validate hash to avoid gasLimit-error exploit to avoid getting penalized
