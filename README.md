# eb-mvp-nodejs-sdk-01

This NodeJS SDK is a client for interacting with the envbee API (see https://envbee.dev).
It provides methods to retrieve variables and manage caching for improved performance.

## Table of contents

- [Installation](#installation)
- [Usage](#usage)
- [License](#license)

## Installation

```bash
npm install envbee-sdk
```

## Usage

```javascript
// First, import the SDK
const envbeeInit = require("envbee-sdk");

// Provide your API key and secret
const envbee = envbeeInit({
  key: "YOUR_ENVBEE_API_KEY",
  secret: "YOUR_ENVBEE_API_SECRET"
});

// And you're good to go!
const databaseHost = await envbee.get("DATABASE_HOST");

// You can also list all the variables you have available
const allVariables = await envbee.getAllVariables();
```

If you want more details check [the API docs](https://docs.envbee.dev).

## License

This project is licensed under the MIT License. See the LICENSE file for details.
