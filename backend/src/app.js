require('dotenv').config();

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const jobRoutes = require('./routes/jobRoutes');
const tradeRoutes = require('./routes/tradeRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(express.json());

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

// Central error handler to keep controllers cleaner.
app.use(errorHandler);

module.exports = app;

