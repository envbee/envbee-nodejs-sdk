/**************************************
 * Copyright (c) envbee
 * Licensed under the MIT License.
 **************************************/

const crypto = require("crypto");
const bunyan = require("bunyan");
const storage = require("node-persist");

const { API_URL, ENDPOINTS, ERRORS } = require("./constants");
const { MISSING_KEY_AND_SECRET } = ERRORS;
const { VARIABLES_V1, VARIABLES_VALUES_V1 } = ENDPOINTS;

const envbeeInit = function envbeeInit(parameters) {
  const logger = bunyan.createLogger({
    name: "envbee-sdk",
    level: "debug"
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
    logging: true
  });
  logger.debug("Cache storage initialized");

  const apiURL = parameters.apiURL ?? API_URL;

  const generateHmacHeader = (urlPath, apiSecret) => {
    logger.debug(`Generating HMAC header for URL: ${urlPath}`);

    const hmac = crypto.createHmac("sha256", apiSecret);
    const timestamp = Date.now().toString();

    hmac.update(timestamp);
    hmac.update("GET");
    hmac.update(urlPath);

    const content = JSON.stringify({});
    const contentHash = crypto.createHash("md5").update(content).digest("hex");
    hmac.update(contentHash);

    const hmacDigest = hmac.digest("hex");
    logger.debug(`Generated HMAC header: HMAC ${timestamp}:${hmacDigest}`);

    return `HMAC ${timestamp}:${hmacDigest}`;
  };

  const doFetch = async function doFetch(urlBase, urlPath, params = {}) {
    try {
      const [baseRoute, query] = urlPath.split("?");
      const searchParams = new URLSearchParams(query || "");
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, value);
        }
      });
      urlPath = `${baseRoute}?${searchParams.toString()}`;

      logger.debug(`Sending request to URL: ${urlPath}`);

      const hmacHeader = generateHmacHeader(urlPath, secret);
      const headers = {
        "Content-Type": "application/json",
        "x-api-key": key,
        Authorization: hmacHeader
      };
      logger.debug(`Request Headers: ${JSON.stringify(headers)}`);

      const res = await fetch(`${urlBase}${urlPath}`, { headers });

      if (res.status === 200) {
        logger.debug(`Request successful. Status code: ${res.status}`);
        const resContent = await res.json();
        return resContent;
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
  const getVariableValue = async function getVariableValue(variableName) {
    logger.debug(`Fetching value for variable: ${variableName}`);
    try {
      result = await doFetch(apiURL, `${VARIABLES_VALUES_V1}/${variableName}`);
      try {
        storage.defaultInstance.set(result.name, result);
      } catch (error) {}
      return result;
    } catch (error) {
      return await storage.defaultInstance.get(variableName);
    }
  };

  const getAllVariables = async function getAllVariables(
    offset = undefined,
    limit = undefined
  ) {
    logger.debug("Fetching all variables.");
    try {
      result = await doFetch(apiURL, VARIABLES_V1, {
        limit: limit,
        offset: offset
      });
      const res = result;
      for (const variable of JSON.parse(JSON.stringify(result.data))) {
        try {
          await storage.setItem(variable.name, variable);
        } catch (error) {}
      }
      return res;
    } catch (error) {
      if (error.message.includes("Authentication failed")) throw error;
      const keys = await storage.defaultInstance.keys();
      const result = await Promise.all(
        keys.map(async (key) => ({
          name: key,
          value: (await storage.defaultInstance.get(key)).value
        }))
      );
      return { data: result, metadata: null };
    }
  };

  const setLogLevel = (level) => {
    logger.level(level);
  };

  const envbee = {
    get: getVariableValue,
    getAllVariables,
    setLogLevel
  };

  return envbee;
};

module.exports = envbeeInit;
