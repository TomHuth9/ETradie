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

const app = express();

app.use(express.json());

// Rate limiting: auth 10/min per IP, general API 100/min per IP
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: 'Too many attempts; try again later.' },
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { message: 'Too many requests; try again later.' },
});
app.use('/auth', authLimiter);
app.use('/jobs', apiLimiter);
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

