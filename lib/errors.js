class DecryptionError extends Error {
  constructor(message, cause) {
    super(message, { cause });
    this.name = 'DecryptionError';
  }
}

module.exports = { DecryptionError };
