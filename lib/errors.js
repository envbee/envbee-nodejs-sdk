class DecryptionError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "DecryptionError";
    this.cause = cause;
  }
}

module.exports = { DecryptionError };
