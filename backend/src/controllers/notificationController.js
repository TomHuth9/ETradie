const prisma = require('../prismaClient');

// GET /notifications — list notifications for the current user
async function listMyNotifications(req, res, next) {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(notifications);
  } catch (err) {
    next(err);
  }
}

// POST /notifications/:id/read — mark a single notification as read
async function markNotificationRead(req, res, next) {
  try {
    const id = Number(req.params.id);
    const notif = await prisma.notification.findUnique({
      where: { id },
    });
    if (!notif || notif.userId !== req.user.id) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    const updated = await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// POST /notifications/read-all — mark all as read
async function markAllRead(req, res, next) {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listMyNotifications,
  markNotificationRead,
  markAllRead,
};

