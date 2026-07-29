const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');

// JWT authentication middleware. Expects an Authorization header of the form
// "Bearer <token>". Beyond verifying the signature, it also checks the
// token's embedded tokenVersion against the user's current value in the DB —
// this is what lets a password change/reset invalidate every previously
// issued token for that account, since a signed JWT can't otherwise be
// revoked before it naturally expires.
module.exports = async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization header missing or malformed' });
  }

  const token = authHeader.split(' ')[1];

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, tokenVersion: true },
    });

    if (!user || user.tokenVersion !== payload.tokenVersion) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    req.user = {
      id: user.id,
      role: user.role,
    };

    next();
  } catch (err) {
    next(err);
  }
};

