const prisma = require('../prismaClient');
const { createNotification } = require('../services/notificationService');

// Helper: check if the current user can access this job's conversation (homeowner or accepted tradesperson).
async function getJobIfParticipant(jobId, userId) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      responses: {
        where: { response: 'ACCEPTED' },
        take: 1,
        select: { tradespersonId: true },
      },
    },
  });
  if (!job) return null;
  if (job.status !== 'ACCEPTED' && job.status !== 'COMPLETED') return null;
  const acceptedTradespersonId = job.responses[0]?.tradespersonId;
  const isParticipant =
    job.homeownerId === userId || acceptedTradespersonId === userId;
  if (!isParticipant) return null;
  return job;
}

// GET /jobs/:id/messages
async function listMessages(req, res, next) {
  try {
    const id = Number(req.params.id);
    const job = await getJobIfParticipant(id, req.user.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found or access denied' });
    }

    const messages = await prisma.message.findMany({
      where: { jobId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: { id: true, name: true },
        },
      },
    });

    res.json(messages);
  } catch (err) {
    next(err);
  }
}

// POST /jobs/:id/messages
async function sendMessage(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { content } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const job = await getJobIfParticipant(id, req.user.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found or access denied' });
    }

    const message = await prisma.message.create({
      data: {
        jobId: id,
        senderId: req.user.id,
        content: content.trim(),
      },
      include: {
        sender: {
          select: { id: true, name: true },
        },
      },
    });

    const io = req.app.get('io');
    if (io && job.homeownerId) {
      io.to(`user:${job.homeownerId}`).emit('message:new', { jobId: id, message });
    }
    const acceptedTradespersonId = job.responses?.[0]?.tradespersonId;
    if (io && acceptedTradespersonId && acceptedTradespersonId !== req.user.id) {
      io.to(`user:${acceptedTradespersonId}`).emit('message:new', { jobId: id, message });
    }

    // Notifications for the other party in the conversation.
    const recipientId =
      job.homeownerId === req.user.id ? acceptedTradespersonId : job.homeownerId;
    if (recipientId && recipientId !== req.user.id) {
      await createNotification(req, {
        userId: recipientId,
        type: 'message',
        message: `New message on \"${job.title}\"`,
        link: `/jobs/${id}`,
      });
    }

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listMessages,
  sendMessage,
};
