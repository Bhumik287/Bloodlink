/**
 * Centralized Error Handling Middleware
 * Course Reference: Unit-3 Backend Frameworks (Express error middleware)
 */

function errorHandler(err, req, res, next) {
  console.error('[Server Error]', {
    path: req.originalUrl,
    method: req.method,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });

  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);

  res.status(statusCode).json({
    success: false,
    message: err.message || 'An unexpected internal server error occurred.',
    errors: err.errors || null
  });
}

function notFoundHandler(req, res, next) {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: `API endpoint not found: ${req.method} ${req.originalUrl}`
    });
  }
  // For HTML requests, send 404 or redirect to index
  res.status(404).sendFile(require('path').join(__dirname, '../../public/index.html'));
}

module.exports = {
  errorHandler,
  notFoundHandler
};
