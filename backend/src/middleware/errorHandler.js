// Centralised error handler so controllers can throw or call next(err) and we still return a consistent JSON error shape.
//
// Every controller in this codebase handles its own expected errors
// (validation, auth, not-found, etc.) via a direct res.status(x).json(...)
// call — nothing ever reaches next(err) except genuinely unexpected failures
// (a bug, a DB error, ...). Those always come through here as an untyped
// Error with no .status, so err.message is often internal detail (e.g. a raw
// Prisma error) that shouldn't be handed to the client. err.status is kept
// as an escape hatch in case something does deliberately throw a
// status-carrying error in future — that message is trusted, since it was
// chosen on purpose.
module.exports = function errorHandler(err, _req, res, _next) {
  console.error(err);

  const status = err.status || 500;
  const isUnexpected = status === 500;
  const hideDetails = isUnexpected && process.env.NODE_ENV === 'production';
  const message = hideDetails ? 'Something went wrong' : err.message || 'Something went wrong';

  res.status(status).json({ message });
};

