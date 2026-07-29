require('dotenv').config();

const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const jobRoutes = require('./routes/jobRoutes');
const tradeRoutes = require('./routes/tradeRoutes');
const userRoutes = require('./routes/userRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const errorHandler = require('./middleware/errorHandler');
const { sanitize } = require('./middleware/sanitize');

const app = express();

// Render (and most PaaS hosts) sit behind a reverse proxy that sets X-Forwarded-For. Trust the first hop so express-rate-limit and req.ip see the real client IP instead of throwing/misattributing it.
app.set('trust proxy', 1);

// Reject bodies larger than 50 KB to prevent payload-based DoS.
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));

// Strip HTML tags, null bytes, and control characters from all string inputs before any route or validation middleware sees them.
app.use(sanitize);

// Rate limiting: auth 5 attempts per 15 mins per IP, onboarding 10/15min, general API 100/min per IP
// Strict limiter for credential-guessing-sensitive endpoints only.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many attempts; try again in 15 minutes.' },
  skip: () => process.env.NODE_ENV === 'test',
});
// Looser limiter for multi-step onboarding endpoints (register -> resend -> verify),
// which aren't credential-guessing targets but a shared 5-request budget with login
// meant a legitimate new user could get locked out mid-signup.
const onboardingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many attempts; try again in 15 minutes.' },
  skip: () => process.env.NODE_ENV === 'test',
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { message: 'Too many requests; try again later.' },
});
// Strict limiter only on credential-submission endpoints; /auth/me and profile management routes use the general limiter so repeated page loads don't 429.
app.use('/auth/login', authLimiter);
app.use('/auth/reset-password', authLimiter);
app.use('/auth/register', onboardingLimiter);
app.use('/auth/verify-email', onboardingLimiter);
app.use('/auth/resend-verification', onboardingLimiter);
app.use('/auth/forgot-password', onboardingLimiter);
app.use('/auth', apiLimiter);
app.use('/jobs', apiLimiter);
app.use('/trades', apiLimiter);
app.use('/users', apiLimiter);
app.use('/notifications', apiLimiter);
app.use('/admin', apiLimiter);

// Configure CORS so the React dev server (and deployed frontend) can talk to this API.
// CLIENT_URL is defined in .env; fall back to a sensible local default.
// Browsers treat "www.example.com" and "example.com" as different origins, so
// whichever variant CLIENT_URL points at, allow the other one too.
const rawClientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = new Set([rawClientUrl]);
try {
  const clientUrl = new URL(rawClientUrl);
  const altHost = clientUrl.hostname.startsWith('www.')
    ? clientUrl.hostname.slice(4)
    : `www.${clientUrl.hostname}`;
  allowedOrigins.add(`${clientUrl.protocol}//${altHost}`);
} catch (_) {
  // rawClientUrl wasn't a valid URL; only the exact string above is allowed.
}

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header (curl, server-to-server, health checks) — allow.
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// Simple health check endpoint for debugging.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'etradie-backend' });
});

// Mount API routes.
app.use('/auth', authRoutes);
app.use('/jobs', jobRoutes);
app.use('/trades', tradeRoutes);
app.use('/users', userRoutes);
app.use('/notifications', notificationRoutes);
app.use('/admin', adminRoutes);

// Central error handler to keep controllers cleaner.
app.use(errorHandler);

module.exports = app;

