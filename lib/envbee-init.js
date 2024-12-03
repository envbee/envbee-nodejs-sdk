const { API_URL, API_VERSION, ENDPOINTS, ERRORS } = require("./constants");

const { MISSING_KEY_AND_SECRET } = ERRORS;
const { VARIABLES, VARIABLES_VALUES } = ENDPOINTS;

const envbeeInit = function envbeeInit(parameters) {
  if (!parameters) throw new Error(MISSING_KEY_AND_SECRET);

  const { key, secret } = parameters;
  if (!key || !secret) throw new Error(MISSING_KEY_AND_SECRET);

  const apiURL = parameters.apiURL ?? API_URL;
  const apiVersion = parameters.apiVersion ?? API_VERSION;

  const doFetch = async function doFetch(url) {
    const headers = {
      "Content-Type": "application/json",
      "x-api-key": key,
      "x-api-secret": secret,
    };
    const res = await fetch(url, { headers });

    if (res.status === 200) {
      const resContent = await res.json();
      return resContent;
    } else {
      const error = await res.json();
      throw error;
    }
  };

  /**
   * Get variable value
   * @param {string} variableName
   * @returns {string}
   */
  const getVariableValue = async function getVariableValue(variableName) {
    return doFetch(
      `${apiURL}/${apiVersion}${VARIABLES_VALUES}/${variableName}`
    );
  };

  const getAllVariables = async function getAllVariables() {
    return doFetch(`${apiURL}/${apiVersion}${VARIABLES}`);
  };

  const envbee = {
    get: getVariableValue,
    getAllVariables,
  };

  return envbee;
};

module.exports = envbeeInit;
