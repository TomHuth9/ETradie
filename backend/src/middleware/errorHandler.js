// Centralised error handler so controllers can throw or call next(err) and we still return a consistent JSON error shape.
module.exports = function errorHandler(err, _req, res, _next) {
  console.error(err);

  const status = err.status || 500;
  const message = err.message || 'Something went wrong';

  res.status(status).json({ message });
};

