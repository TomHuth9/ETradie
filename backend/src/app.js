require('dotenv').config();

const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const jobRoutes = require('./routes/jobRoutes');
const tradeRoutes = require('./routes/tradeRoutes');
const userRoutes = require('./routes/userRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const errorHandler = require('./middleware/errorHandler');
const { sanitize } = require('./middleware/sanitize');

const app = express();

// Reject bodies larger than 50 KB to prevent payload-based DoS.
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));

// Strip HTML tags, null bytes, and control characters from all string inputs
// before any route or validation middleware sees them.
app.use(sanitize);

// Rate limiting: auth 5 attempts per 15 mins per IP, general API 100/min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many attempts; try again in 15 minutes.' },
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { message: 'Too many requests; try again later.' },
});
// Strict limiter only on credential-submission endpoints; /auth/me and profile
// management routes use the general limiter so repeated page loads don't 429.
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);
app.use('/auth/forgot-password', authLimiter);
app.use('/auth/reset-password', authLimiter);
app.use('/auth', apiLimiter);
app.use('/jobs', apiLimiter);
app.use('/trades', apiLimiter);
app.use('/users', apiLimiter);
app.use('/notifications', apiLimiter);

// Configure CORS so the React dev server can talk to this API.
// CLIENT_URL is defined in .env; fall back to a sensible local default.
const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: allowedOrigin,
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

// Central error handler to keep controllers cleaner.
app.use(errorHandler);

module.exports = app;

