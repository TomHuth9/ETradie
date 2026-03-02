const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { idParamSchema } = require('../validators/schemas');
const { getRatingForUser, getProfile, listReviewsForUser } = require('../controllers/reviewController');

router.get('/:id/rating', auth, validateRequest(idParamSchema), getRatingForUser);
router.get('/:id/profile', auth, validateRequest(idParamSchema), getProfile);
router.get('/:id/reviews', auth, validateRequest(idParamSchema), listReviewsForUser);

module.exports = router;
