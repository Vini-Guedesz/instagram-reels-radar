class AppError extends Error {
  constructor(message, statusCode = 500, options = {}) {
    super(message);
    this.name = options.name || "AppError";
    this.statusCode = statusCode;
    this.headers = options.headers || {};
    this.isRetryable = Boolean(options.isRetryable);
  }
}

module.exports = {
  AppError
};
