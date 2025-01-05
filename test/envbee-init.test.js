const dotenv = require("dotenv");
const envbeeInit = require("../lib/envbee-init");
const test = require("ava");

dotenv.config({ path: "test/.env" });

const key = process.env.ENVBEE_API_KEY ?? "MOCK---API-KEY";
const secret = process.env.ENVBEE_API_SECRET ?? "MOCK---API-SECRET";
const apiURL = process.env.ENVBEE_API_URL;

const MISSING_KEY_AND_SECRET = "Missing key and / or secret";

let originalFetch;

test.beforeEach(() => {
  originalFetch = global.fetch;
});

test.afterEach(() => {
  global.fetch = originalFetch;
});

test("envbee-init - Missing key and / or secret", function (t) {
  const error1 = t.throws(() => envbeeInit());
  t.like(error1, { message: MISSING_KEY_AND_SECRET });
  const error2 = t.throws(() => envbeeInit({}));
  t.like(error2, { message: MISSING_KEY_AND_SECRET });
  const error3 = t.throws(() => envbeeInit({ key: "key" }));
  t.like(error3, { message: MISSING_KEY_AND_SECRET });
  const error4 = t.throws(() => envbeeInit({ secret: "secret" }));
  t.like(error4, { message: MISSING_KEY_AND_SECRET });
  const error5 = t.throws(() => envbeeInit({ key: null, secret: "secret" }));
  t.like(error5, { message: MISSING_KEY_AND_SECRET });
  const error6 = t.throws(() => envbeeInit({ key: "key", secret: null }));
  t.like(error6, { message: MISSING_KEY_AND_SECRET });
  const error7 = t.throws(() => envbeeInit({ key: null, secret: null }));
  t.like(error7, { message: MISSING_KEY_AND_SECRET });
});

test("envbee-init - Valid parameters", function (t) {
  const envbee = envbeeInit({ apiURL, key, secret });
  t.not(envbee, null);
  t.not(envbee, undefined);
  t.is(typeof envbee, "object");
});

test("envbee-init - Get all variables (invalid credentials)", async function (t) {
  const envbee = envbeeInit({ apiURL, key, secret: "INVALID_SECRET" });

  global.fetch = async (url) => {
    return {
      ok: true,
      status: 401,
      json: () =>
        Promise.resolve({
          message: "Authentication failed: incorrect api_key or api_secret"
        })
    };
  };

  try {
    await envbee.getAllVariables();
  } catch (error) {
    t.like(error, {
      message: "Authentication failed: incorrect api_key or api_secret"
    });
  }
});

test("envbee-init - Get all variables", async function (t) {
  const envbee = envbeeInit({ apiURL, key, secret });

  global.fetch = async (url) => {
    return {
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          metadata: { limit: 1, offset: 10, total: 100 },
          data: [{ name: "VAR1", value: "VALUE1" }]
        })
    };
  };

  const { data, metadata } = await envbee.getAllVariables();

  t.is(typeof metadata.limit, "number");
  t.is(typeof metadata.offset, "number");
  t.is(typeof metadata.total, "number");
  t.true(metadata.total > 0);

  t.true(Array.isArray(data));
  t.true(data.length > 0);

  const [variable1] = data;
  t.is(typeof variable1.name, "string");
  t.is(typeof variable1.value, "string");
});

test("envbee-init - Get all variables (with pagination)", async function (t) {
  const envbee = envbeeInit({ apiURL, key, secret });

  global.fetch = async (url) => {
    return {
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          metadata: { limit: 1, offset: 10, total: 100 },
          data: [{ name: "VAR1", value: "VALUE1" }]
        })
    };
  };

  const { data, metadata } = await envbee.getAllVariables(10, 1);

  t.is(typeof metadata.limit, "number");
  t.is(typeof metadata.offset, "number");
  t.is(typeof metadata.total, "number");
  t.true(metadata.total > 0);

  t.true(Array.isArray(data));
  t.true(data.length > 0);

  const [variable1] = data;
  t.is(typeof variable1.name, "string");
  t.is(typeof variable1.value, "string");

  t.is("VAR1", variable1.name);
  t.is("VALUE1", variable1.value);
});

test("envbee-init - Get variable value", async function (t) {
  const envbee = envbeeInit({ apiURL, key, secret });

  global.fetch = async (url) => {
    return {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ name: "VAR1", value: "VALUE1" })
    };
  };
  const value = await envbee.get("VAR1");
  t.is(typeof value.name, "string");
  t.is(typeof value.value, "string");
});

test("envbee-init - Get variables from cache", async function (t) {
  const envbee = envbeeInit({ apiURL, key, secret });

  global.fetch = async (url) => {
    return {
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          metadata: { limit: 50, offset: 0, total: 1 },
          data: [
            { name: "VAR1", value: "VALUE1" },
            { name: "V2", value: [3, 4, 5] }
          ]
        })
    };
  };

  // Invoke the app to store the value in the cache
  {
    const { data, metadata } = await envbee.getAllVariables();
    t.is("VALUE1", data[0].value);
  }

  // Force an error
  global.fetch = async (url) => {
    return {
      ok: true,
      status: 500,
      json: () => Promise.resolve({ message: "Forced error" })
    };
  };

  // Value will be retrieved from cache
  const envbee2 = envbeeInit({ apiURL, key, secret });
  const { data, metadata } = await envbee2.getAllVariables();

  t.is("VALUE1", data[0].value);
});
