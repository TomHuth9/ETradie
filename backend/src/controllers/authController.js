const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');
const { geocodeToLatLng } = require('../services/geocodingService');

// Helper to generate a JWT for a user.
function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
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
    const { name, email, password, role, address, townOrCity } = req.body;

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
      if (!address) {
        return res.status(400).json({ message: 'address is required for homeowners' });
      }
      locationText = address;
      const coords = await geocodeToLatLng(address);
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

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: prismaRole,
        address: prismaRole === 'HOMEOWNER' ? locationText : null,
        townOrCity: prismaRole === 'TRADESPERSON' ? locationText : null,
        lat,
        lng,
      },
    });

    const token = generateToken(user);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        address: user.address,
        townOrCity: user.townOrCity,
        lat: user.lat,
        lng: user.lng,
      },
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

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        address: user.address,
        townOrCity: user.townOrCity,
        lat: user.lat,
        lng: user.lng,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  validatePassword,
};

