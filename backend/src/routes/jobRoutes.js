const express = require('express');
const router = express.Router();

const auth = require('../middleware/authMiddleware');
const {
  createJob,
  getJobById,
  respondToJob,
  getMyJobs,
  getNearbyJobs,
  cancelJob,
  completeJob,
} = require('../controllers/jobController');

// All job routes require a logged-in user.
router.post('/', auth, createJob); // POST /jobs
router.get('/my', auth, getMyJobs); // GET /jobs/my
router.get('/nearby', auth, getNearbyJobs); // GET /jobs/nearby (must be before /:id)
router.get('/:id', auth, getJobById); // GET /jobs/:id
router.post('/:id/respond', auth, respondToJob); // POST /jobs/:id/respond
router.post('/:id/cancel', auth, cancelJob); // POST /jobs/:id/cancel
router.post('/:id/complete', auth, completeJob); // POST /jobs/:id/complete

module.exports = router;

