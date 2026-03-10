const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');
const { haversineDistanceKm } = require('../utils/haversine');

// This file wires up Socket.IO and exposes a helper for broadcasting new jobs.
// Express controllers can call the helper without knowing any Socket.IO details.
module.exports = function initSockets(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  // Attach the io instance to the server so we can reach it from controllers if needed.
  server.io = io;

  // Authenticate socket connections using the same JWT as the REST API.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error('Missing auth token'));
      }

      const payload = jwt.verify(token, process.env.JWT_SECRET);

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        return next(new Error('User not found for socket connection'));
      }

      // Store minimal user data on the socket for distance calculations.
      socket.user = {
        id: user.id,
        role: user.role,
        lat: user.lat,
        lng: user.lng,
      };

      // Each user joins their own room so we can send targeted events later if needed.
      socket.join(`user:${user.id}`);

      next();
    } catch (err) {
      next(new Error('Socket authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (user ${socket.user?.id})`);

    // Mark user as online while they have at least one active socket connection.
    if (socket.user?.id) {
      prisma.user
        .update({
          where: { id: socket.user.id },
          data: { isOnline: true },
        })
        .catch(() => {});
    }

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      const userId = socket.user?.id;
      if (!userId) return;
      // Only mark offline if no other active sockets for this user remain.
      const hasOtherConnection = Array.from(io.sockets.sockets.values()).some(
        (s) => s.id !== socket.id && s.user?.id === userId
      );
      if (!hasOtherConnection) {
        prisma.user
          .update({
            where: { id: userId },
            data: { isOnline: false },
          })
          .catch(() => {});
      }
    });
  });

  // Helper function called when a new job is created.
  async function broadcastNewJob(job) {
    const RADIUS_KM = 25;

    const { lat: jobLat, lng: jobLng } = job;

    if (jobLat == null || jobLng == null) {
      return;
    }

    for (const [, socket] of io.sockets.sockets) {
      const user = socket.user;

      if (!user || user.role !== 'TRADESPERSON') {
        continue;
      }

      if (user.lat == null || user.lng == null) {
        continue;
      }

      const distance = haversineDistanceKm(
        jobLat,
        jobLng,
        user.lat,
        user.lng
      );

      if (distance <= RADIUS_KM) {
        socket.emit('job:new', {
          id: job.id,
          title: job.title,
          description: job.description,
          category: job.category,
          locationText: job.locationText,
          createdAt: job.createdAt,
        });
      }
    }
  }

  // Expose the helper on the server instance for access in controllers.
  server.broadcastNewJob = broadcastNewJob;

  return io;
};

