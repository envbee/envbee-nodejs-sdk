# [1.9.0](https://github.com/envbee/envbee-nodejs-sdk/compare/v1.8.2...v1.9.0) (2026-05-20)


### Features

* add fillEnvVars support and TypeScript typings ([#3](https://github.com/envbee/envbee-nodejs-sdk/issues/3)) ([f60f418](https://github.com/envbee/envbee-nodejs-sdk/commit/f60f418d3017085c1540f18358d107c0bbadddb4))

# Changelog

All notable changes to this project will be documented in this file.

## [1.8.2] - 2025-06-25

### Added

- Compatibility support for Node v14+
- fix: wrong handling of non string values trying to be decrypted

## [1.8.1] - 2025-06-24

### Added

- Allow SDK configuration via environment variables

## [1.8.0] - 2025-06-08

### Added

- Ability to desencrypt variable values using AES-256-GCM

## [1.7.4] - 2025-03-13 - beta release

### Added

- Several improvements and bug fixes

## [0.1.0] - 2024-10-15

### Added

- Initial implementation of the envbee SDK.
- Support for getting a single variable with `get_variable()`.
- Support for getting multiple variables with `get_variables()`.
- Support for HMAC Authentication
