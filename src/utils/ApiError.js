/**
 * @description Common Error class to throw an error from anywhere.
 */

class ApiError extends Error {
  constructor(statusCode, message = "Something went wrong", isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

module.exports = ApiError;
