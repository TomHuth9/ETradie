const express = require('express');
const router = express.Router();

const auth = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const {
  createJobSchema,
  respondToJobSchema,
  submitReviewSchema,
  sendMessageSchema,
} = require('../validators/schemas');
const {
  createJob,
  getJobById,
  respondToJob,
  getMyJobs,
  getNearbyJobs,
  cancelJob,
  completeJob,
  closeJob,
} = require('../controllers/jobController');
const { listMessages, sendMessage } = require('../controllers/messageController');
const { submitReview, listReviewsForJob } = require('../controllers/reviewController');

router.post('/', auth, validateRequest(createJobSchema), createJob);
router.get('/my', auth, getMyJobs); // GET /jobs/my
router.get('/nearby', auth, getNearbyJobs); // GET /jobs/nearby (must be before /:id)
router.get('/:id/messages', auth, listMessages);
router.post('/:id/messages', auth, validateRequest(sendMessageSchema), sendMessage);
router.get('/:id/reviews', auth, listReviewsForJob);
router.post('/:id/reviews', auth, validateRequest(submitReviewSchema), submitReview);
router.get('/:id', auth, getJobById);
router.post('/:id/respond', auth, validateRequest(respondToJobSchema), respondToJob);
router.post('/:id/cancel', auth, cancelJob);
router.post('/:id/close', auth, closeJob);
router.post('/:id/complete', auth, completeJob);

module.exports = router;

