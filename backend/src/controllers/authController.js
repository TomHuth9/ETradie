const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../prismaClient');
const { geocodeToLatLng } = require('../services/geocodingService');
const { sendVerificationEmail } = require('../services/emailService');
const { formatAddress } = require('../utils/formatAddress');

const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000;

function generateVerificationCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

// Helper to generate a JWT for a user. tokenVersion is embedded so a
// password change/reset (which bumps it) invalidates every previously-issued
// token for this account — see authMiddleware.
function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion,
    },
    process.env.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: '7d',
    }
  );
}

function validatePassword(password) {
  if (typeof password !== 'string') return 'Password is required';
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must include at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include at least one number';
  }
  return null;
}

// POST /auth/register
// Registers either a homeowner or a tradesperson and geocodes their location.
async function register(req, res, next) {
  try {
    const { name, email, password, role, addressLine1, addressLine2, addressCity, addressPostcode, townOrCity } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'name, email, password and role are required' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: 'A user with that email already exists' });
    }

    let prismaRole;
    if (role === 'homeowner') {
      prismaRole = 'HOMEOWNER';
    } else if (role === 'tradesperson') {
      prismaRole = 'TRADESPERSON';
    } else {
      return res.status(400).json({ message: 'role must be homeowner or tradesperson' });
    }

    let locationText = null;
    let lat = null;
    let lng = null;

    if (prismaRole === 'HOMEOWNER') {
      if (!addressLine1 || !addressCity || !addressPostcode) {
        return res.status(400).json({ message: 'addressLine1, addressCity and addressPostcode are required for homeowners' });
      }
      // Geocode on line 1 + city + postcode only — a flat/unit number (line 2)
      // doesn't affect building-level coordinates and can confuse the free-text
      // geocoder when that exact unit isn't in its dataset.
      const coords = await geocodeToLatLng(formatAddress({ addressLine1, addressCity, addressPostcode }));
      lat = coords.lat;
      lng = coords.lng;
    } else if (prismaRole === 'TRADESPERSON') {
      if (!townOrCity) {
        return res.status(400).json({ message: 'townOrCity is required for tradespeople' });
      }
      locationText = townOrCity;
      const coords = await geocodeToLatLng(townOrCity);
      lat = coords.lat;
      lng = coords.lng;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationCode = generateVerificationCode();

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: prismaRole,
        addressLine1: prismaRole === 'HOMEOWNER' ? addressLine1.trim() : null,
        addressLine2: prismaRole === 'HOMEOWNER' && addressLine2 ? addressLine2.trim() : null,
        addressCity: prismaRole === 'HOMEOWNER' ? addressCity.trim() : null,
        addressPostcode: prismaRole === 'HOMEOWNER' ? addressPostcode.trim() : null,
        townOrCity: prismaRole === 'TRADESPERSON' ? locationText : null,
        lat,
        lng,
        emailVerificationCode: verificationCode,
        emailVerificationExpiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
      },
    });

    try {
      await sendVerificationEmail(user.email, verificationCode);
    } catch (emailErr) {
      console.error('Verification email failed:', emailErr?.response?.body ?? emailErr.message);
    }

    res.status(201).json({
      message: 'Account created. Check your email for a 6-digit verification code.',
      email: user.email,
      ...(process.env.NODE_ENV !== 'production' ? { devVerificationCode: verificationCode } : {}),
    });
  } catch (err) {
    next(err);
  }
}

// POST /auth/login
// Logs a user in and returns a JWT plus basic profile info.
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        message: 'Please verify your email before logging in.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        addressLine1: user.addressLine1,
        addressLine2: user.addressLine2,
        addressCity: user.addressCity,
        addressPostcode: user.addressPostcode,
        townOrCity: user.townOrCity,
        lat: user.lat,
        lng: user.lng,
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /auth/verify-email — email + 6-digit code, activates the account and logs in.
async function verifyEmail(req, res, next) {
  try {
    const { email, code } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or code' });
    }

    if (user.emailVerified) {
      const token = generateToken(user);
      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          addressLine1: user.addressLine1,
          addressLine2: user.addressLine2,
          addressCity: user.addressCity,
          addressPostcode: user.addressPostcode,
          townOrCity: user.townOrCity,
          lat: user.lat,
          lng: user.lng,
        },
      });
    }

    if (
      !user.emailVerificationCode ||
      user.emailVerificationCode !== code ||
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt < new Date()
    ) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    const verifiedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationCode: null,
        emailVerificationExpiresAt: null,
      },
    });

    const token = generateToken(verifiedUser);

    res.json({
      token,
      user: {
        id: verifiedUser.id,
        name: verifiedUser.name,
        email: verifiedUser.email,
        role: verifiedUser.role,
        addressLine1: verifiedUser.addressLine1,
        addressLine2: verifiedUser.addressLine2,
        addressCity: verifiedUser.addressCity,
        addressPostcode: verifiedUser.addressPostcode,
        townOrCity: verifiedUser.townOrCity,
        lat: verifiedUser.lat,
        lng: verifiedUser.lng,
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /auth/resend-verification — issues a fresh code for an unverified account.
async function resendVerificationCode(req, res, next) {
  try {
    const { email } = req.body;
    const genericResponse = { message: 'If that account exists and needs verifying, we sent a new code.' };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerified) {
      return res.json(genericResponse);
    }

    const verificationCode = generateVerificationCode();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationCode: verificationCode,
        emailVerificationExpiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
      },
    });

    try {
      await sendVerificationEmail(user.email, verificationCode);
    } catch (emailErr) {
      console.error('Verification email failed:', emailErr?.response?.body ?? emailErr.message);
    }

    res.json({
      ...genericResponse,
      ...(process.env.NODE_ENV !== 'production' ? { devVerificationCode: verificationCode } : {}),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerificationCode,
  validatePassword,
  generateToken,
};

