const constants = {
  API_URL: "https://api.envbee.dev",
  ENDPOINTS: {
    VARIABLES_V1: "/v1/variables",
    VARIABLES_VALUES_V1: "/v1/variables-values",
    VARIABLES_VALUES_BY_NAME_V1: "/v1/variables-values-by-name"
  },
  ERRORS: {
    MISSING_KEY_AND_SECRET: "Missing key and / or secret"
  },
  ENC_PREFIX: "envbee:enc:v1:"
};

module.exports = constants;
