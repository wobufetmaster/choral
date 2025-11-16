/**
 * Centralized error handling middleware for Express
 *
 * Catches all errors thrown in route handlers and provides consistent
 * error responses with proper logging.
 *
 * Usage:
 *   app.use(errorHandler);  // Add as last middleware
 */

/**
 * Error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
function errorHandler(err, req, res, next) {
  // Determine status code from error or default to 500
  const statusCode = err.statusCode || err.status || 500;

  // Log error with context
  console.error(`[${req.method} ${req.path}] Error (${statusCode}):`, err.message);

  // Log stack trace for 500 errors in development
  if (statusCode === 500 && process.env.NODE_ENV !== 'production') {
    console.error('Stack trace:', err.stack);
  }

  // Send error response
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    // Include stack in development only
    ...(process.env.NODE_ENV !== 'production' && statusCode === 500 && {
      stack: err.stack
    })
  });
}

module.exports = errorHandler;
