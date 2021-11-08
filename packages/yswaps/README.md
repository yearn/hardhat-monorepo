# YSWAPS

[![Lint](https://github.com/yearn/hardhat-monorepo/actions/workflows/lint.yml/badge.svg)](https://github.com/yearn/hardhat-monorepo/actions/workflows/lint.yml)
[![Tests](https://github.com/yearn/hardhat-monorepo/actions/workflows/tests.yml/badge.svg)](https://github.com/yearn/hardhat-monorepo/actions/workflows/tests.yml)

This repository contains all the smart contracts pertaining to yswaps.

## ⚠️ Audit

These contracts have not been audited yet, use at your own risk.

## 📘 Registry
Deployed contracts are at the [registry](./REGISTRY.md).

## 👨‍💻 Development environment

- Copy environment file

```bash
cp .env.example .env
```

- Fill environment file with your information

```bash
nano .env
```

## 🧪 Testing

### Unit

```bash
yarn test:unit
```

Will run all tests under [/test/unit](./test/unit)

### E2E

```bash
yarn test:e2e
```

Will run all tests under [/test/e2e](./test/e2e)

### Integration

You will need to set up the development environment first, please refer to the [development environment](#-development-environment) section.

```bash
yarn test:integration
```

Will run all tests under [/test/integration](./test/integration)

## 🚢 Deployment

You will need to set up the development environment first, please refer to the [development environment](#-development-environment) section.

```bash
yarn deploy:[network]
```

The plugin `hardhat-deploy` is used to deploy contracts.

## Licensing

The primary license for yswaps is the GNU (`GNU V3`), see [`LICENSE`](./LICENSE).
