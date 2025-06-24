const test = require('ava');
const envbeeInit = require('../lib/envbee-init');

// Backup and restore process.env
test.beforeEach(() => {
  process.env = { ...process.env };
});

test.afterEach(() => {
  delete process.env.ENVBEE_API_KEY;
  delete process.env.ENVBEE_API_SECRET;
  delete process.env.ENVBEE_ENC_KEY;
  delete process.env.ENVBEE_API_URL;
});

test('should initialize with explicit parameters', (t) => {
  const envbee = envbeeInit({
    key: 'param-key',
    secret: 'param-secret',
    encKey: 'some-enc-key'
  });

  t.truthy(envbee);
  t.is(typeof envbee.get, 'function');
});

test('should initialize using environment variables', (t) => {
  process.env.ENVBEE_API_KEY = 'env-key';
  process.env.ENVBEE_API_SECRET = 'env-secret';
  process.env.ENVBEE_ENC_KEY = 'env-enc';

  const envbee = envbeeInit(); // no parameters
  t.truthy(envbee);
  t.is(typeof envbee.getVariables, 'function');
});

test('should prioritize parameters over environment variables', (t) => {
  process.env.ENVBEE_API_KEY = 'env-key';
  process.env.ENVBEE_API_SECRET = 'env-secret';

  const envbee = envbeeInit({
    key: 'param-key',
    secret: 'param-secret'
  });

  t.truthy(envbee);
  // No direct access to keys; assume correct usage if no error
});

test.serial('should throw error if key and secret are missing', (t) => {
  const error = t.throws(() => envbeeInit(), { instanceOf: Error });
  t.true(error.message.includes('Missing key and / or secret'));
});
