# envbee NodeJS SDK

This NodeJS SDK is a client for interacting with the envbee API (see [https://envbee.dev](https://envbee.dev)).
It provides methods to retrieve variables and manage caching for improved performance.

## Requirements

- Node.js version **14.21** or higher is required.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Environment Variables](#environment-variables)
- [Methods](#methods)
- [Encryption](#encryption)
- [Logging](#logging)
- [Caching](#caching)
- [API Documentation](#api-documentation)
- [License](#license)

## Installation

Install the SDK using npm:

```bash
npm install --save envbee-sdk
```

## Usage

To use the SDK, initialize it with your API key and secret (either via parameters or environment variables):

```javascript
const envbeeInit = require("envbee-sdk");

const envbee = envbeeInit({
  key: "YOUR_ENVBEE_API_KEY",
  secret: "YOUR_ENVBEE_API_SECRET",
  // Optional: encryption key as a 32-byte Buffer or a string
  encKey: Buffer.from("your-32-byte-encryption-key-here", "utf-8")
});

// Retrieve a variable
const value = await envbee.get("YOUR_ENVIRONMENT_VARIABLE_NAME");

// Retrieve all variables
const allVariables = await envbee.getAllVariables();
```

## Environment Variables

You can configure the SDK using environment variables instead of passing parameters explicitly:

- `ENVBEE_API_KEY`: your API key (required if `key` is not passed)
- `ENVBEE_API_SECRET`: your API secret (required if `secret` is not passed)
- `ENVBEE_ENC_KEY`: optional encryption key for decrypting encrypted variables

Example using environment variables:

```bash
export ENVBEE_API_KEY="your_api_key"
export ENVBEE_API_SECRET="your_api_secret"
export ENVBEE_ENC_KEY="32-byte-encryption-key-goes-here"
```

Then initialize the client with no parameters:

```javascript
const envbeeInit = require("envbee-sdk");

const envbee = envbeeInit();

const value = await envbee.get("YOUR_ENVIRONMENT_VARIABLE_NAME");
```

If both parameters and environment variables are set, parameters take precedence.

## Methods

- `get(variableName)`: fetch a variable value.
- `getVariables(offset, limit)`: fetch multiple variable definitions with pagination.

### Encryption

Some environment variables in envbee may be encrypted using AES-256-GCM. This SDK supports automatic decryption if you provide the correct encryption key (`encKey`) during initialization.

- Encrypted values from the API are prefixed with `envbee:enc:v1:`.
- If a variable is encrypted and no or incorrect key is provided, decryption will fail.
- Decryption is done locally; the encryption key is never sent to the API.

Example of providing the encryption key:

```javascript
const encKey = Buffer.from("32-byte-long-encryption-key-goes-here", "utf-8");

const envbee = envbeeInit({
  key: "YOUR_ENVBEE_API_KEY",
  secret: "YOUR_ENVBEE_API_SECRET",
  encKey
});
```

## Logging

The SDK includes built-in logging with adjustable log levels. You can set the log level dynamically:

```javascript
// Set log level to 'warn' to reduce verbosity
envbee.setLogLevel("warn");
```

Supported levels are: `fatal`, `error`, `warn`, `info`, `debug`, and `trace`.

## Caching

The SDK caches variables locally to provide fallback data when offline or the API is unreachable. The cache is updated after each successful API call. Local cache stores variables as received from the API, encrypted or plain.

- Encryption key is never stored in cache or sent to API.
- All encryption/decryption happens locally with AES-256-GCM.

## API Documentation

For more information on envbee API endpoints and usage, visit the [official API documentation](https://docs.envbee.dev).

## License

This project is licensed under the MIT License. See the LICENSE file for details.
