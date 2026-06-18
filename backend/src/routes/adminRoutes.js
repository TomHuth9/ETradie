const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const adminOnly = require('../middleware/adminMiddleware');
const { getAllJobs, getAllUsers, deleteUser } = require('../controllers/adminController');

router.use(auth, adminOnly);

router.get('/jobs', getAllJobs);
router.get('/users', getAllUsers);
router.delete('/users/:id', deleteUser);

module.exports = router;
