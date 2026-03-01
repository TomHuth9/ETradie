const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');
const { geocodeToLatLng } = require('../services/geocodingService');
const { validatePassword } = require('./authController');

function serializeUser(user) {
  const categories = Array.isArray(user.tradespersonCategories)
    ? user.tradespersonCategories.map((tc) => tc.category)
    : [];
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    address: user.address,
    townOrCity: user.townOrCity,
    lat: user.lat,
    lng: user.lng,
    availability: user.availability,
    categories,
  };
}

// GET /auth/me — current user profile (with categories if tradesperson).
async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.role === 'TRADESPERSON') {
      try {
        const categories = await prisma.tradespersonCategory.findMany({
          where: { userId: user.id },
          select: { category: true },
        });
        user.tradespersonCategories = categories;
      } catch (_) {
        user.tradespersonCategories = [];
      }
    } else {
      user.tradespersonCategories = [];
    }

    const out = serializeUser(user);
    res.json(out);
  } catch (err) {
    next(err);
  }
}

// PATCH /auth/profile — update name, address/townOrCity (re-geocode), availability (tradesperson), categories (tradesperson).
async function updateProfile(req, res, next) {
  try {
    const { name, address, townOrCity, availability, categories } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const updates = {};
    if (name != null && String(name).trim()) updates.name = String(name).trim();

    if (user.role === 'HOMEOWNER' && address != null) {
      updates.address = String(address).trim();
      try {
        const coords = await geocodeToLatLng(updates.address);
        updates.lat = coords.lat;
        updates.lng = coords.lng;
      } catch (_) {
        // leave lat/lng unchanged on geocode failure
      }
    }

    if (user.role === 'TRADESPERSON') {
      if (townOrCity != null) {
        updates.townOrCity = String(townOrCity).trim();
        try {
          const coords = await geocodeToLatLng(updates.townOrCity);
          updates.lat = coords.lat;
          updates.lng = coords.lng;
        } catch (_) {}
      }
      if (typeof availability === 'boolean') updates.availability = availability;
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: updates,
      include: { tradespersonCategories: { select: { category: true } } },
    });

    if (user.role === 'TRADESPERSON' && Array.isArray(categories)) {
      await prisma.tradespersonCategory.deleteMany({ where: { userId: req.user.id } });
      const valid = categories.filter((c) => c && typeof c === 'string');
      if (valid.length > 0) {
        await prisma.tradespersonCategory.createMany({
          data: valid.map((category) => ({ userId: req.user.id, category })),
          skipDuplicates: true,
        });
      }
      const withCat = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { tradespersonCategories: { select: { category: true } } },
      });
      return res.json(serializeUser(withCat));
    }

    res.json(serializeUser(updated));
  } catch (err) {
    next(err);
  }
}

// POST /auth/change-password — current password + new password.
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'currentPassword and newPassword are required' });
    }
    const err = validatePassword(newPassword);
    if (err) return res.status(400).json({ message: err });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash },
    });
    res.json({ message: 'Password updated' });
  } catch (err) {
    next(err);
  }
}

// POST /auth/forgot-password — send reset token (in production: email; here we return token for dev).
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'email is required' });

    const user = await prisma.user.findUnique({ where: { email: String(email).trim() } });
    if (!user) {
      return res.json({ message: 'If that email exists, we sent a reset link.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpiresAt: expiresAt },
    });

    if (process.env.NODE_ENV !== 'production') {
      return res.json({ message: 'Reset token (dev only)', resetToken: token, expiresAt });
    }
    // TODO: send email with link containing token
    res.json({ message: 'If that email exists, we sent a reset link.' });
  } catch (err) {
    next(err);
  }
}

// POST /auth/reset-password — token + new password.
async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'token and newPassword are required' });
    }
    const err = validatePassword(newPassword);
    if (err) return res.status(400).json({ message: err });

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiresAt: { gt: new Date() },
      },
    });
    if (!user) return res.status(400).json({ message: 'Invalid or expired reset token' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpiresAt: null },
    });
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  serializeUser,
};
