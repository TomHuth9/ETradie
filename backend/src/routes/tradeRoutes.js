const express = require('express');
const router = express.Router();

const { listTradeCategories } = require('../controllers/tradeController');

// Public endpoint so the frontend can dynamically populate dropdowns.
router.get('/categories', listTradeCategories); // GET /trades/categories

module.exports = router;

