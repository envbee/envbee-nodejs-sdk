const dotenv = require("dotenv");
const envbeeInit = require("../lib/envbee-init");
const test = require("ava");
const { ENC_PREFIX } = require("../lib/constants");
const crypto = require("crypto");

dotenv.config({ path: "test/.env" });

const key = process.env.ENVBEE_API_KEY ?? "MOCK---API-KEY";
const secret = process.env.ENVBEE_API_SECRET ?? "MOCK---API-SECRET";
const apiURL = process.env.ENVBEE_API_URL;
const encKey = process.env["ENVBEE_ENC_SECRET"] ?? "0123456789abcdef0123456789abcdef";

const MISSING_KEY_AND_SECRET = "Missing key and / or secret";

let originalFetch;

function encrypt(encKey, plaintext) {
  if (!encKey || !plaintext) {
    throw new Error("Missing encryption key or plaintext");
  }

  // Derive 32-byte key from encKey using SHA-256
  const key = crypto.createHash("sha256").update(encKey).digest(); // 32 bytes

  // Generate a 12-byte IV (nonce) for AES-GCM
  const iv = crypto.randomBytes(12);

  // Encrypt using AES-256-GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Concatenate IV + ciphertext + auth tag
  const fullEncrypted = Buffer.concat([iv, encrypted, authTag]);

  // Return with ENC_PREFIX and base64 encoding
  return ENC_PREFIX + fullEncrypted.toString("base64");
}

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

  await t.throwsAsync(async () => envbee.getVariables(), { message: "Authentication failed: incorrect api_key or api_secret" });
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
          data: [
            {
              id: 9999,
              type: "STRING",
              name: "DATABASE_HOST",
              description: "IP address or name of the database server"
            }
          ]
        })
    };
  };

  const { data, metadata } = await envbee.getVariables();

  t.is(typeof metadata.limit, "number");
  t.is(typeof metadata.offset, "number");
  t.is(typeof metadata.total, "number");
  t.true(metadata.total > 0);

  t.true(Array.isArray(data));
  t.true(data.length > 0);

  const [variable1] = data;
  t.is(typeof variable1.name, "string");
  t.is(typeof variable1.id, "number");
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
          data: [{ name: "VAR1", content: { value: "VALUE1" } }]
        })
    };
  };

  const { data, metadata } = await envbee.getVariables(10, 1);

  t.is(typeof metadata.limit, "number");
  t.is(typeof metadata.offset, "number");
  t.is(typeof metadata.total, "number");
  t.true(metadata.total > 0);

  t.true(Array.isArray(data));
  t.true(data.length > 0);

  const [variable1] = data;
  t.is(typeof variable1.name, "string");
  t.is(typeof variable1.content, "object");

  t.is("VAR1", variable1.name);
  t.is("VALUE1", variable1.content.value);
});

test("envbee-init - Get variable value", async function (t) {
  const envbee = envbeeInit({ apiURL, key, secret });

  global.fetch = async (url) => {
    return {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ value: "db.server.prod" })
    };
  };
  const value = await envbee.get("VAR1");

  t.is("db.server.prod", value);
});

test("envbee-init - Get variable value from cache", async function (t) {
  const envbee = envbeeInit({ apiURL, key, secret });

  global.fetch = async (url) => {
    return {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ value: "db.server.prod" })
    };
  };

  // Invoke the app to store the value in the cache
  {
    const data = await envbee.get("VAR1");
    t.is("db.server.prod", data);
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
  const data = await envbee2.get("VAR1");

  t.is("db.server.prod", data);
});

test("envbee-init - Get variables - unexpected status code", async function (t) {
  const envbee = envbeeInit({ apiURL, key, secret });

  global.fetch = async () => {
    return {
      ok: false,
      status: 404,
      json: () => Promise.resolve({ message: "Not Found" })
    };
  };

  await t.throwsAsync(
    async () => {
      await envbee.getVariables();
    },
    { message: "Not Found" }
  );
});

test("envbee-init - Get variables - fetch throws", async function (t) {
  const envbee = envbeeInit({ apiURL, key, secret });

  global.fetch = async () => {
    throw new Error("Network error");
  };

  await t.throwsAsync(() => envbee.getVariables(), { message: "Network error" });
});

test("envbee-init - Get encrypted variable value (SECURE_STRING)", async function (t) {
  const envbee = envbeeInit({ apiURL, key, secret, encKey });

  const originalValue = "super-secret-password";

  const encrypted = await encrypt(encKey, originalValue);

  global.fetch = async () => {
    return {
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          type: "SECURE_STRING",
          value: encrypted
        })
    };
  };

  const decrypted = await envbee.get("SECURE_VAR");
  t.is(decrypted, originalValue);
});

test("envbee-init - Get encrypted encrypted by the CLI tool", async function (t) {
  const envbee = envbeeInit({ apiURL, key, secret, encKey });

  const originalValue = "super-secret-password";

  const encrypted = "envbee:enc:v1:d0ktKfDJB4CIPbRmXfOmVlCU8ZCx4fl/2eZtkjgbqJy3g569ZGDEqnVOP94pDfw2Jg==";

  global.fetch = async () => {
    return {
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          type: "STRING",
          value: encrypted
        })
    };
  };

  const decrypted = await envbee.get("SECURE_VAR");
  t.is(decrypted, originalValue);
});

test("envbee-init - Decryption fails with wrong secret", async function (t) {
  const originalValue = "sensitive-info";
  const encrypted = await encrypt(encKey, originalValue);

  const envbee = envbeeInit({ apiURL, key, secret, encKey: "WRONG_SECRET" });

  global.fetch = async () => {
    return {
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          type: "SECURE_STRING",
          value: encrypted
        })
    };
  };

  const error = await t.throwsAsync(async () => envbee.get("SECURE_VAR"));
  t.regex(error.message, /decrypt/i);
});

test("envbee-init - Get encrypted variable from cache", async function (t) {
  const envbee = envbeeInit({ apiURL, key, secret, encKey });

  const originalValue = "cached-secret";
  const encrypted = await encrypt(encKey, originalValue);

  global.fetch = async () => {
    return {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ type: "SECURE_STRING", value: encrypted })
    };
  };

  const val1 = await envbee.get("SECURE_CACHED_VAR");
  t.is(val1, originalValue);

  global.fetch = async () => {
    throw new Error("Should not reach fetch again");
  };

  const val2 = await envbee.get("SECURE_CACHED_VAR");
  t.is(val2, originalValue);
});
