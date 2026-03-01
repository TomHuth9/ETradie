const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { getRatingForUser, getProfile } = require('../controllers/reviewController');

router.get('/:id/rating', auth, getRatingForUser);
router.get('/:id/profile', auth, getProfile);

module.exports = router;
