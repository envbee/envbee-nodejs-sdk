/**************************************
 * Copyright (c) envbee
 * Licensed under the MIT License.
 **************************************/

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const envPathsModule = require("env-paths");
const bunyan = require("bunyan");
const storage = require("node-persist");
const { version } = require("../package.json");
const { DecryptionError } = require("./errors");
const { VariableType, toVariable, toVariableValue } = require("./models");

const { API_URL, ENDPOINTS, ERRORS, ENC_PREFIX } = require("./constants");
const { MISSING_KEY_AND_SECRET } = ERRORS;
const { VARIABLES_V1, VARIABLES_VALUES_V1, VARIABLES_VALUES_BY_NAME_V1 } = ENDPOINTS;
const envPaths = typeof envPathsModule === "function" ? envPathsModule : envPathsModule.default;

const createInMemoryCacheStore = function createInMemoryCacheStore() {
  const memory = new Map();
  return {
    async set(cacheKey, value) {
      memory.set(cacheKey, value);
    },
    async get(cacheKey) {
      return memory.has(cacheKey) ? memory.get(cacheKey) : null;
    },
    async keys() {
      return Array.from(memory.keys());
    }
  };
};

const ensureDirectoryIsWritable = function ensureDirectoryIsWritable(dirPath) {
  const probeFile = path.join(dirPath, `.envbee-write-test-${process.pid}-${Date.now()}`);
  fs.writeFileSync(probeFile, "ok");
  fs.unlinkSync(probeFile);
};

const envbeeInit = function envbeeInit(parameters) {
  const logger = bunyan.createLogger({
    name: "envbee-sdk",
    level: "warn"
  });

  // Allow fallback to environment variables
  const key = parameters?.key ?? process.env.ENVBEE_API_KEY;
  const secret = parameters?.secret ?? process.env.ENVBEE_API_SECRET;
  const apiURL2 = parameters?.apiURL ?? process.env.ENVBEE_API_URL ?? API_URL;
  const encKey = parameters?.encKey ?? process.env.ENVBEE_ENC_KEY;
  const timeoutSecondsRaw = parameters?.timeoutSeconds ?? 4;

  if (!key || !secret) {
    logger.error("API key or secret is missing.");
    throw new Error(MISSING_KEY_AND_SECRET);
  }

  // Derive a 32-byte key from the provided encKey using SHA-256
  const aesgcm = deriveKey(encKey);
  const safeCacheKey = String(key).replace(/[^\w.-]/g, "_");
  const appPaths = envPaths("envbee", { suffix: "" });
  const defaultCacheDir = path.join(appPaths.cache, `envbee_${safeCacheKey}`);
  const cacheDir = parameters?.cachePath ?? defaultCacheDir;

  let cacheStore;
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    ensureDirectoryIsWritable(cacheDir);
    const persistentStorage = storage.create();
    persistentStorage.initSync({
      dir: cacheDir,
      logging: false
    });
    cacheStore = persistentStorage;
    logger.debug("Cache storage initialized");
  } catch (err) {
    logger.warn("Cache directory unavailable. Falling back to in-memory cache only.", err);
    cacheStore = createInMemoryCacheStore();
  }

  const safeCacheSet = async function safeCacheSet(variableName, value) {
    try {
      await cacheStore.set(variableName, value);
    } catch (err) {
      logger.warn(`Error setting variable ${variableName} in cache: ${err.message}`, err);
    }
  };

  const safeCacheGet = async function safeCacheGet(variableName) {
    try {
      return await cacheStore.get(variableName);
    } catch (err) {
      logger.warn(`Error getting variable ${variableName} from cache: ${err.message}`, err);
      return null;
    }
  };

  const safeCacheKeys = async function safeCacheKeys() {
    try {
      return await cacheStore.keys();
    } catch (err) {
      logger.warn(`Error enumerating cache keys: ${err.message}`, err);
      return [];
    }
  };

  const apiURL = apiURL2 ?? API_URL;
  const parsedTimeoutSeconds = Number(timeoutSecondsRaw);
  const timeoutSeconds =
    Number.isFinite(parsedTimeoutSeconds) && parsedTimeoutSeconds > 0 ? parsedTimeoutSeconds : 4;
  const timeoutMs = Math.max(1, Math.floor(timeoutSeconds * 1000));

  const fetchWithTimeout = async function fetchWithTimeout(url, options) {
    let timeoutId;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          const timeoutError = new Error(`Request timed out after ${timeoutSeconds} seconds`);
          timeoutError.code = "ETIMEDOUT";
          reject(timeoutError);
        }, timeoutMs);
      });

      return await Promise.race([fetch(url, options), timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  const generateHmacHeader = function generateHmacHeader(urlPath, apiSecret) {
    logger.debug(`Generating HMAC header for URL: ${urlPath}`);

    const hmac = crypto.createHmac("sha256", apiSecret);
    const timestamp = Date.now().toString();

    hmac.update(timestamp);
    hmac.update("GET");
    hmac.update(urlPath);

    const contentHash = crypto.createHash("md5").update("{}").digest("hex");
    hmac.update(contentHash);

    const hmacDigest = hmac.digest("hex");
    logger.debug(`Generated HMAC header: HMAC ${timestamp}:${hmacDigest}`);

    return `HMAC ${timestamp}:${hmacDigest}`;
  };

  function deriveKey(encKey) {
    if (!encKey) return null;
    if (typeof encKey === "string") {
      return crypto.createHash("sha256").update(encKey).digest(); // 32 bytes
    } else if (Buffer.isBuffer(encKey) || encKey instanceof Uint8Array) {
      if (encKey.length !== 32) {
        throw new Error("Encryption key must be 32 bytes long");
      }
      return Buffer.from(encKey);
    } else {
      throw new TypeError("encKey must be a string or a Buffer of length 32");
    }
  }

  // Check if the value is encrypted and decrypt it if possible
  const tryDecryptValue = async function tryDecryptValue(value) {
    if (typeof value !== "string" || !value.startsWith(ENC_PREFIX)) return value;

    if (!aesgcm) {
      throw new DecryptionError("Received encrypted value, but no encryption key was provided");
    }

    try {
      const payload = value.substring(ENC_PREFIX.length);
      const decoded = Buffer.from(payload, "base64");

      const iv = decoded.subarray(0, 12); // 12 bytes nonce
      const ciphertextAndTag = decoded.subarray(12); // ciphertext + tag

      const decipher = crypto.createDecipheriv("aes-256-gcm", aesgcm, iv);
      const authTag = ciphertextAndTag.subarray(ciphertextAndTag.length - 16);
      const ciphertext = ciphertextAndTag.subarray(0, ciphertextAndTag.length - 16);

      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return decrypted.toString("utf8");
    } catch (err) {
      logger.warn("Decryption failed:", err);

      // Check if the error message corresponds to an actual decryption/authentication failure
      if (
        err instanceof Error &&
        err.message === "Unsupported state or unable to authenticate data"
      ) {
        throw new DecryptionError("Failed to decrypt: authentication failed", err);
      }

      throw new Error("Failed to decrypt envbee value");
    }
  };

  const doFetch = async function doFetch(urlBase, urlPath, params = {}) {
    try {
      const [baseRoute, query] = urlPath.split("?");
      const searchParams = new URLSearchParams(query ?? "");
      Object.entries(params).forEach(function ([key, value]) {
        if (value !== undefined && value !== null) {
          searchParams.set(key, value);
        }
      });
      const completeURLPath = `${baseRoute}${searchParams.size > 0 ? "?" : ""}${searchParams.toString()}`;
      logger.debug(`Sending request to URL: ${completeURLPath}`);

      const hmacHeader = generateHmacHeader(completeURLPath, secret);
      const headers = {
        "Content-Type": "application/json",
        "x-api-key": key,
        "x-envbee-client": `node-sdk/${version}`,
        Authorization: hmacHeader
      };
      logger.debug(`Request Headers: ${JSON.stringify(headers)}`);

      const res = await fetchWithTimeout(`${urlBase}${completeURLPath}`, { headers });

      if (res.status === 200) {
        logger.debug(`Request successful. Status code: ${res.status}`);
        return await res.json();
      } else {
        const errorBody = await res.json();
        logger.error(
          `Request failed. Status code: ${res.status}. Error: ${JSON.stringify(errorBody)}`
        );

        // Throw a proper Error object with structured message
        const error = new Error(errorBody?.message || errorBody);
        error.status = res.status; // Attach HTTP status for downstream handling
        error.responseBody = errorBody; // Attach raw error response if needed
        throw error;
      }
    } catch (error) {
      logger.fatal(
        `Error during the request to ${urlBase}${urlPath}: ${error?.message || error}`,
        error
      );
      throw error; // Re-throws the error after logging it
    }
  };

  /**
   * Get variable value
   * @param {string} variableName
   * @returns {string}
   */
  const getVariableValueContentByName = async function getVariableValueContentByName(variableName) {
    logger.debug(`Fetching content for variable: ${variableName}`);
    try {
      const result = await doFetch(
        apiURL,
        `${VARIABLES_VALUES_BY_NAME_V1}/${variableName}/content`
      );
      try {
        await safeCacheSet(variableName, result);
      } catch (err) {
        logger.error(`Error setting variable ${variableName} in cache: ${err.message}`, err);
      }
      return await tryDecryptValue(result.value);
    } catch (err) {
      logger.error(`Error fetching variable ${variableName}: ${err.message}`, err);

      if (err instanceof DecryptionError) {
        throw err;
      }

      const cached = await safeCacheGet(variableName);
      if (!cached) {
        logger.warn(`No cached value found for ${variableName}`);
        return null; //ToDo: Should throw an exception instead?
      }
      return await tryDecryptValue(cached?.value);
    }
  };

  const getVariables = async function getAllVariables(offset, limit) {
    logger.debug("Fetching all variables.");
    return await doFetch(apiURL, VARIABLES_V1, { limit, offset });
  };

  const getVariablesValues = async function getVariablesValues(offset, limit) {
    logger.debug("Fetching all variables values.");
    return await doFetch(apiURL, VARIABLES_VALUES_V1, { limit, offset });
  };

  const getVariablesTyped = async function getVariablesTyped(offset, limit) {
    const result = await getVariables(offset, limit);
    return {
      ...result,
      data: Array.isArray(result?.data) ? result.data.map(toVariable) : []
    };
  };

  const getVariablesValuesTyped = async function getVariablesValuesTyped(offset, limit) {
    const result = await getVariablesValues(offset, limit);
    return {
      ...result,
      data: Array.isArray(result?.data) ? result.data.map(toVariableValue) : []
    };
  };

  const fillEnvVars = async function fillEnvVars(variableNames) {
    logger.debug("Filling environment variables: %j", variableNames);
    try {
      const allVariables = (await getVariablesTyped()).data;
      const allVariablesValues = (await getVariablesValuesTyped()).data;

      for (const variable of allVariables) {
        const { name, id } = variable;
        try {
          if (Array.isArray(variableNames) && !variableNames.includes(name)) {
            logger.debug("Skipping variable %s as it's not in the specified list.", name);
            continue;
          }

          const variableValue = allVariablesValues.find((value) => value.variable_id === id);
          const rawValue = variableValue?.content?.value;
          if (rawValue === undefined || rawValue === null) {
            logger.warn("Variable %s returned null/undefined and was not set.", name);
            continue;
          }

          const finalValue = typeof rawValue === "string" ? await tryDecryptValue(rawValue) : rawValue;
          process.env[name] = String(finalValue);
          logger.debug("Set environment variable: %s", name);
        } catch (err) {
          logger.error(`Error fetching or setting variable ${name}: ${err.message}`, err);
        }
      }
    } catch (err) {
      logger.warn(`Failed to fill environment variables from API, using cache: ${err.message}`);
      const keys = await safeCacheKeys();
      for (const cacheKey of keys) {
        if (Array.isArray(variableNames) && !variableNames.includes(cacheKey)) {
          logger.debug("Skipping variable %s as it's not in the specified list.", cacheKey);
          continue;
        }

        const cached = await safeCacheGet(cacheKey);
        if (!cached || cached.value === undefined || cached.value === null) {
          logger.warn("Variable %s returned null/undefined from cache and was not set.", cacheKey);
          continue;
        }

        const finalValue =
          typeof cached.value === "string" ? await tryDecryptValue(cached.value) : cached.value;
        process.env[cacheKey] = String(finalValue);
        logger.debug("Set environment variable from cache: %s", cacheKey);
      }
    }
  };

  const envbee = {
    VariableType,
    getVariablesTyped,
    getVariablesValues,
    getVariablesValuesTyped,
    fillEnvVars,
    getVariables,
    get: getVariableValueContentByName,
    setLogLevel: (newLevel) => logger.level(newLevel)
  };

  return envbee;
};

module.exports = envbeeInit;
