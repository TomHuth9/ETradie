const express = require('express');
const router = express.Router();

const auth = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const {
  createJobSchema,
  submitQuoteSchema,
  acceptQuoteSchema,
  submitReviewSchema,
  sendMessageSchema,
  idParamSchema,
  getMyJobsSchema,
  getNearbyJobsSchema,
} = require('../validators/schemas');
const {
  createJob,
  getJobById,
  submitQuote,
  declineJob,
  listQuotesForJob,
  acceptQuote,
  getMyJobs,
  getNearbyJobs,
  cancelJob,
  completeJob,
  closeJob,
} = require('../controllers/jobController');
const { listMessages, sendMessage } = require('../controllers/messageController');
const { submitReview, listReviewsForJob } = require('../controllers/reviewController');

router.post('/', auth, validateRequest(createJobSchema), createJob);
router.get('/my', auth, validateRequest(getMyJobsSchema), getMyJobs);
router.get('/nearby', auth, validateRequest(getNearbyJobsSchema), getNearbyJobs);
router.get('/:id/messages', auth, validateRequest(idParamSchema), listMessages);
router.post('/:id/messages', auth, validateRequest(sendMessageSchema), sendMessage);
router.get('/:id/reviews', auth, validateRequest(idParamSchema), listReviewsForJob);
router.post('/:id/reviews', auth, validateRequest(submitReviewSchema), submitReview);
router.get('/:id', auth, validateRequest(idParamSchema), getJobById);
router.get('/:id/quotes', auth, validateRequest(idParamSchema), listQuotesForJob);
router.post('/:id/quote', auth, validateRequest(submitQuoteSchema), submitQuote);
router.post('/:id/decline', auth, validateRequest(idParamSchema), declineJob);
router.post('/:id/quotes/:responseId/accept', auth, validateRequest(acceptQuoteSchema), acceptQuote);
router.post('/:id/cancel', auth, validateRequest(idParamSchema), cancelJob);
router.post('/:id/close', auth, validateRequest(idParamSchema), closeJob);
router.post('/:id/complete', auth, validateRequest(idParamSchema), completeJob);

module.exports = router;
