const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { listMyNotifications, markNotificationRead, markAllRead } = require('../controllers/notificationController');

router.use(auth);

router.get('/', listMyNotifications);
router.post('/read-all', markAllRead);
router.post('/:id/read', markNotificationRead);

module.exports = router;

