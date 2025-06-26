/**************************************
 * Copyright (c) envbee
 * Licensed under the MIT License.
 **************************************/

const crypto = require("crypto");
const bunyan = require("bunyan");
const storage = require("node-persist");
const { version } = require("../package.json");
const { DecryptionError } = require("./errors");

const { API_URL, ENDPOINTS, ERRORS, ENC_PREFIX } = require("./constants");
const { MISSING_KEY_AND_SECRET } = ERRORS;
const { VARIABLES_V1, VARIABLES_VALUES_BY_NAME_V1 } = ENDPOINTS;

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

  if (!key || !secret) {
    logger.error("API key or secret is missing.");
    throw new Error(MISSING_KEY_AND_SECRET);
  }

  // Derive a 32-byte key from the provided encKey using SHA-256
  const aesgcm = deriveKey(encKey);

  storage.initSync({
    dir: `${__dirname}/envbee_${key}`,
    logging: false
  });
  logger.debug("Cache storage initialized");

  const apiURL = apiURL2 ?? API_URL;

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

      const res = await fetch(`${urlBase}${completeURLPath}`, { headers });

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
        await storage.set(variableName, result);
      } catch (err) {
        logger.error(`Error setting variable ${variableName} in cache: ${err.message}`, err);
      }
      return await tryDecryptValue(result.value);
    } catch (err) {
      logger.error(`Error fetching variable ${variableName}: ${err.message}`, err);

      if (err instanceof DecryptionError) {
        throw err;
      }

      const cached = await storage.get(variableName);
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

  const envbee = {
    getVariables,
    get: getVariableValueContentByName,
    setLogLevel: (newLevel) => logger.level(newLevel)
  };

  return envbee;
};

module.exports = envbeeInit;
