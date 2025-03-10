/**************************************
 * Copyright (c) envbee
 * Licensed under the MIT License.
 **************************************/

const crypto = require("crypto");
const bunyan = require("bunyan");
const storage = require("node-persist");

const { API_URL, ENDPOINTS, ERRORS } = require("./constants");
const { MISSING_KEY_AND_SECRET } = ERRORS;
const { VARIABLES_V1, VARIABLES_VALUES_BY_NAME_V1 } = ENDPOINTS;

const envbeeInit = function envbeeInit(parameters) {
  const logger = bunyan.createLogger({
    name: "envbee-sdk",
    level: "warn"
  });

  if (!parameters) {
    logger.error("Missing parameters for envbee initialization.");
    throw new Error(MISSING_KEY_AND_SECRET);
  }

  const { key, secret } = parameters;
  if (!key || !secret) {
    logger.error("API key or secret is missing.");
    throw new Error(MISSING_KEY_AND_SECRET);
  }

  storage.initSync({
    dir: `${__dirname}/envbee_${key}`,
    logging: false
  });
  logger.debug("Cache storage initialized");

  const apiURL = parameters.apiURL ?? API_URL;

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

  const doFetch = async function doFetch(urlBase, urlPath, params = {}) {
    try {
      const [baseRoute, query] = urlPath.split("?");
      const searchParams = new URLSearchParams(query ?? "");
      Object.entries(params).forEach(function ([key, value]) {
        if (value !== undefined && value !== null) {
          searchParams.set(key, value);
        }
      });
      const completeURLPath = `${baseRoute}${
        searchParams.size > 0 ? "?" : ""
      }${searchParams.toString()}`;
      logger.debug(`Sending request to URL: ${completeURLPath}`);

      const hmacHeader = generateHmacHeader(completeURLPath, secret);
      const headers = {
        "Content-Type": "application/json",
        "x-api-key": key,
        Authorization: hmacHeader
      };
      logger.debug(`Request Headers: ${JSON.stringify(headers)}`);

      const res = await fetch(`${urlBase}${completeURLPath}`, { headers });

      if (res.status === 200) {
        logger.debug(`Request successful. Status code: ${res.status}`);
        return await res.json();
      } else {
        const error = await res.json();
        logger.error(
          `Request failed. Status code: ${res.status}. Error: ${JSON.stringify(
            error
          )}`
        );
        throw error;
      }
    } catch (error) {
      logger.fatal(
        `Error during the request to ${urlBase}${urlPath}: ${error.message}`,
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
  const getVariableValueContentByName =
    async function getVariableValueContentByName(variableName) {
      logger.debug(`Fetching content for variable: ${variableName}`);
      try {
        const result = await doFetch(
          apiURL,
          `${VARIABLES_VALUES_BY_NAME_V1}/${variableName}/content`
        );
        try {
          storage.defaultInstance.set(variableName, result);
        } catch (err) {
          logger.error(
            `Error setting variable ${variableName} in cache: ${err.message}`,
            err
          );
        }
        return result.value;
      } catch (err) {
        logger.error(
          `Error fetching variable ${variableName}: ${err.message}`,
          err
        );
        const result = await storage.defaultInstance.get(variableName);
        return result?.value;
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
