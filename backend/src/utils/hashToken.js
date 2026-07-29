const crypto = require('crypto');

// For password reset tokens specifically — SHA-256 rather than bcrypt is the
// right tool here. The token is 32 random bytes (256 bits of entropy), not a
// low-entropy secret a human chose, so brute-forcing a hash of it is already
// computationally infeasible regardless of hash speed. A fast, deterministic
// hash also keeps the reset lookup a simple indexed equality query, unlike
// bcrypt which can't be queried directly (each row would need a compare).
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { hashToken };
