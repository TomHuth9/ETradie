const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { idParamSchema } = require('../validators/schemas');
const { listMyNotifications, markNotificationRead, markAllRead } = require('../controllers/notificationController');

router.use(auth);

router.get('/', listMyNotifications);
router.post('/read-all', markAllRead);
router.post('/:id/read', validateRequest(idParamSchema), markNotificationRead);

module.exports = router;

