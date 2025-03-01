# envbee NodeJS SDK

This NodeJS SDK is a client for interacting with the envbee API (see https://envbee.dev).
It provides methods to retrieve variables and manage caching for improved performance.

## Table of contents

- [Installation](#installation)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [License](#license)

## Installation

Install the SDK using npm:

```bash
npm install envbee-sdk
```

## Usage

To use the SDK, initialize it with your `API key` and `API secret`. You can also set the `log level` during initialization (default is `debug`).

```javascript
// First, import the SDK
const envbeeInit = require("envbee-sdk");

// Provide your API key and secret
const envbee = envbeeInit({
  key: "YOUR_ENVBEE_API_KEY",
  secret: "YOUR_ENVBEE_API_SECRET"
});

// And you're good to go!
const databaseHost = await envbee.get("YOUR_ENVIRONMENT_VARIABLE_NAME");

// You can also list all the variables you have available
const allVariables = await envbee.getAllVariables();
```

### Adjust Log Level

You can dynamically change the log level for debugging or monitoring purposes. Supported levels include: `fatal`, `error`, `warn`, `info`, `debug`, and `trace`.

```javascript
// Change log level to 'warn'
envbee.setLogLevel("warn");

// Now only warnings and errors will be logged
```

### Caching

The SDK uses a local cache to store variable values as a failsafe mechanism. The cache is updated with each successful endpoint request and serves as a fallback when the network or Internet connection is temporarily unavailable. Currently, the data is stored unencrypted, but encryption will be implemented in future releases.

## API Documentation

For more details on the available API endpoints and their usage, check [the official API docs](https://docs.envbee.dev).

## License

This project is licensed under the MIT License. See the LICENSE file for details.
