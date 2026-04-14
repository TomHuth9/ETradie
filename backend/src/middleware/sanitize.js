/**
 * Recursively sanitizes all string values in req.body, req.params, and req.query.
 *
 * Removes:
 *  - Null bytes (\0) — can bypass filters and corrupt string handling
 *  - HTML tags (<...>) — prevents stored XSS
 *  - Non-printable control characters (C0 range, excluding tab \x09, newline \x0A, carriage return \x0D)
 *
 * Runs before validateRequest so Zod always sees clean input.
 */

function sanitizeValue(value) {
  if (typeof value === 'string') {
    return value
      .replace(/\0/g, '')                              // null bytes
      .replace(/<[^>]*>/g, '')                         // HTML tags
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // control chars (keep \t \n \r)
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const sanitized = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }
  return value;
}

function sanitize(req, _res, next) {
  req.body = sanitizeValue(req.body);
  req.query = sanitizeValue(req.query);
  req.params = sanitizeValue(req.params);
  next();
}

module.exports = { sanitize };
