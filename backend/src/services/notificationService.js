const prisma = require('../prismaClient');

async function createNotification(req, { userId, type, message, link }) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      message,
      link: link || null,
    },
  });

  const io = req.app && req.app.get('io');
  if (io) {
    io.to(`user:${userId}`).emit('notification:new', notification);
  }

  return notification;
}

module.exports = {
  createNotification,
};

