<h1 align="center">Welcome to hardhat-monorepo 👋</h1>
<p>
  <a href="#" target="_blank">
    <img alt="License: GNU" src="https://img.shields.io/badge/License-GNU-yellow.svg" />
  </a>
  <a href="https://twitter.com/iearnfinance" target="_blank">
    <img alt="Twitter: iearnfinance" src="https://img.shields.io/twitter/follow/iearnfinance.svg?style=social" />
  </a>
</p>

> A monorepo setup using yarn workspace and Lerna for smart contract packages such as yswaps, strategies-keep3r and steath-txs etc.

## Install

```sh
yarn
```

## Run tests

```sh
yarn test
```

## Compile Contracts

```sh
yarn compile
rm -rf node_modules
# or remove the package you changed for faster install
rm -rf node_modules/@yearn/{package_name} # e.g. rm -rf node_modules/@yearn/yswaps
# reinstall to hoist the updated packages
yarn
```

## Author

* Website: https://yearn.finance/
* Twitter: [@iearnfinance](https://twitter.com/iearnfinance)

## 🤝 Contributing

Contributions, issues and feature requests are welcome!

Feel free to check [issues page](https://github.com/yearn/hardhat-monorepo/issues). 

## Show your support

Give a ⭐️ if this project helped you!

***
_This README was generated with ❤️ by [readme-md-generator](https://github.com/kefranabg/readme-md-generator)_
