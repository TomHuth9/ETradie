const express = require('express');
const router = express.Router();

const auth = require('../middleware/authMiddleware');
const {
  createJob,
  getJobById,
  respondToJob,
  getMyJobs,
} = require('../controllers/jobController');

// All job routes require a logged-in user.
router.post('/', auth, createJob); // POST /jobs
router.get('/my', auth, getMyJobs); // GET /jobs/my
router.get('/:id', auth, getJobById); // GET /jobs/:id
router.post('/:id/respond', auth, respondToJob); // POST /jobs/:id/respond

module.exports = router;

