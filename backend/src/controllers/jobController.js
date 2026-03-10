const prisma = require('../prismaClient');
const { geocodeToLatLng } = require('../services/geocodingService');
const { haversineDistanceKm } = require('../utils/haversine');

// POST /jobs
// Homeowner posts a new job. We geocode the job location and broadcast to nearby tradespeople.
async function createJob(req, res, next) {
  try {
    if (req.user.role !== 'HOMEOWNER') {
      return res.status(403).json({ message: 'Only homeowners can create jobs' });
    }

    const { title, description, category, locationText } = req.body;

    if (!title || !description || !category) {
      return res
        .status(400)
        .json({ message: 'title, description and category are required' });
    }

    // Use the provided location text to geocode this specific job.
    const textForGeocoding = locationText;
    if (!textForGeocoding) {
      return res
        .status(400)
        .json({ message: 'locationText is required for a job' });
    }

    const coords = await geocodeToLatLng(textForGeocoding);

    const job = await prisma.job.create({
      data: {
        title,
        description,
        category,
        status: 'PENDING',
        locationText: textForGeocoding,
        lat: coords.lat,
        lng: coords.lng,
        homeowner: {
          connect: { id: req.user.id },
        },
      },
    });
    // Broadcast the new job to nearby tradespeople via Socket.IO.
    const serverInstance = req.app && req.app.get('serverInstance');
    if (serverInstance && typeof serverInstance.broadcastNewJob === 'function') {
      serverInstance.broadcastNewJob(job);
    }

    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
}

// Shared include for accepted tradesperson on a job (relation name on Job is "responses").
const acceptedTradespersonInclude = {
  responses: {
    where: { response: 'ACCEPTED' },
    take: 1,
    include: {
      tradesperson: {
        select: { id: true, name: true },
      },
    },
  },
};

// GET /jobs/:id
async function getJobById(req, res, next) {
  try {
    const id = Number(req.params.id);

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        homeowner: {
          select: {
            id: true,
            name: true,
          },
        },
        ...acceptedTradespersonInclude,
      },
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const acceptedTradespersonId = job.responses?.[0]?.tradesperson?.id;
    if (acceptedTradespersonId && job.responses?.[0]?.tradesperson) {
      try {
        const agg = await prisma.review.aggregate({
          where: { revieweeId: acceptedTradespersonId },
          _avg: { rating: true },
          _count: { rating: true },
        });
        job.responses[0].tradesperson.averageRating =
          agg._avg.rating != null ? Math.round(agg._avg.rating * 10) / 10 : null;
        job.responses[0].tradesperson.reviewCount = agg._count.rating;
      } catch (_) {
      }
    }

    res.json(job);
  } catch (err) {
    next(err);
  }
}

// POST /jobs/:id/respond
// Tradesperson accepts or declines a job.
async function respondToJob(req, res, next) {
  try {
    if (req.user.role !== 'TRADESPERSON') {
      return res
        .status(403)
        .json({ message: 'Only tradespeople can respond to jobs' });
    }

    const id = Number(req.params.id);
    const { response } = req.body;
    const r = typeof response === 'string' ? response.toUpperCase() : '';

    if (r !== 'ACCEPTED' && r !== 'DECLINED') {
      return res
        .status(400)
        .json({ message: 'response must be ACCEPTED or DECLINED' });
    }

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const prismaResponse = r;

    const jobResponse = await prisma.jobResponse.upsert({
      where: {
        jobId_tradespersonId: {
          jobId: id,
          tradespersonId: req.user.id,
        },
      },
      update: {
        response: prismaResponse,
      },
      create: {
        jobId: id,
        tradespersonId: req.user.id,
        response: prismaResponse,
      },
    });

    // If accepted, mark the job itself as ACCEPTED.
    if (prismaResponse === 'ACCEPTED' && job.status === 'PENDING') {
      await prisma.job.update({
        where: { id },
        data: { status: 'ACCEPTED' },
      });
    }

    res.json(jobResponse);
  } catch (err) {
    next(err);
  }
}

const NEARBY_RADIUS_KM = 25;

// GET /jobs/nearby — tradesperson: pending jobs within 25km they haven't responded to.
async function getNearbyJobs(req, res, next) {
  try {
    if (req.user.role !== 'TRADESPERSON') {
      return res.status(403).json({ message: 'Only tradespeople can fetch nearby jobs' });
    }

    const categoryFilter = req.query.category; // optional: filter by trade category

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { tradespersonCategories: { select: { category: true } } },
    });

    if (user?.lat == null || user?.lng == null) {
      return res.json([]);
    }

    const pendingJobs = await prisma.job.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });

    const myResponseJobIds = await prisma.jobResponse.findMany({
      where: { tradespersonId: req.user.id },
      select: { jobId: true },
    }).then((rows) => new Set(rows.map((r) => r.jobId)));

    const myCategories = (user.tradespersonCategories || []).map((tc) => tc.category);
    const filterByCategory = categoryFilter
      ? [categoryFilter]
      : myCategories.length > 0
        ? myCategories
        : null;

    const nearby = pendingJobs.filter((job) => {
      if (myResponseJobIds.has(job.id)) return false;
      if (job.lat == null || job.lng == null) return false;
      const distance = haversineDistanceKm(user.lat, user.lng, job.lat, job.lng);
      if (distance > NEARBY_RADIUS_KM) return false;
      if (filterByCategory && !filterByCategory.includes(job.category)) return false;
      return true;
    });

    const payload = nearby.map((job) => ({
      id: job.id,
      title: job.title,
      description: job.description,
      category: job.category,
      locationText: job.locationText,
      createdAt: job.createdAt,
    }));

    res.json(payload);
  } catch (err) {
    next(err);
  }
}

// GET /jobs/my — optional query: page, limit, status, category
async function getMyJobs(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const status = req.query.status; // PENDING, ACCEPTED, COMPLETED, CANCELLED, CLOSED
    const category = req.query.category; // TradeCategory enum

    if (req.user.role === 'HOMEOWNER') {
      const where = { homeownerId: req.user.id };
      if (status) where.status = status;
      if (category) where.category = category;

      const [jobs, total] = await Promise.all([
        prisma.job.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: acceptedTradespersonInclude,
        }),
        prisma.job.count({ where }),
      ]);

      return res.json({ jobs, total, page, limit });
    }

    if (req.user.role === 'TRADESPERSON') {
      const responses = await prisma.jobResponse.findMany({
        where: { tradespersonId: req.user.id },
        include: { job: { include: acceptedTradespersonInclude } },
        orderBy: { respondedAt: 'desc' },
      });
      let jobs = responses.map((r) => r.job);
      if (status) jobs = jobs.filter((j) => j.status === status);
      if (category) jobs = jobs.filter((j) => j.category === category);
      const total = jobs.length;
      jobs = jobs.slice(skip, skip + limit);
      return res.json({ jobs, total, page, limit });
    }

    return res.status(400).json({ message: 'Unknown user role' });
  } catch (err) {
    next(err);
  }
}

// POST /jobs/:id/cancel — homeowner cancels a job (PENDING or ACCEPTED only).
async function cancelJob(req, res, next) {
  try {
    if (req.user.role !== 'HOMEOWNER') {
      return res.status(403).json({ message: 'Only homeowners can cancel jobs' });
    }

    const id = Number(req.params.id);
    const job = await prisma.job.findUnique({ where: { id } });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.homeownerId !== req.user.id) {
      return res.status(403).json({ message: 'You can only cancel your own jobs' });
    }

    if (job.status !== 'PENDING' && job.status !== 'ACCEPTED') {
      return res.status(400).json({ message: 'Only pending or accepted jobs can be cancelled' });
    }

    await prisma.job.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    res.json({ message: 'Job cancelled', status: 'CANCELLED' });
  } catch (err) {
    next(err);
  }
}

// POST /jobs/:id/complete — homeowner or accepted tradesperson marks job complete.
async function completeJob(req, res, next) {
  try {
    const id = Number(req.params.id);
    const job = await prisma.job.findUnique({
      where: { id },
      include: acceptedTradespersonInclude,
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.status !== 'ACCEPTED') {
      return res.status(400).json({ message: 'Only accepted jobs can be marked complete' });
    }

    const acceptedResponse = job.responses?.[0];
    const acceptedTradespersonId = acceptedResponse?.tradesperson?.id;

    const isHomeowner = req.user.role === 'HOMEOWNER' && job.homeownerId === req.user.id;
    const isAcceptedTradesperson = req.user.role === 'TRADESPERSON' && acceptedTradespersonId === req.user.id;

    if (!isHomeowner && !isAcceptedTradesperson) {
      return res.status(403).json({ message: 'Only the homeowner or the tradesperson who accepted can mark this job complete' });
    }

    await prisma.job.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });

    res.json({ message: 'Job marked complete', status: 'COMPLETED' });
  } catch (err) {
    next(err);
  }
}

// POST /jobs/:id/close — homeowner closes job (no longer needed); only PENDING.
async function closeJob(req, res, next) {
  try {
    if (req.user.role !== 'HOMEOWNER') {
      return res.status(403).json({ message: 'Only homeowners can close jobs' });
    }

    const id = Number(req.params.id);
    const job = await prisma.job.findUnique({ where: { id } });

    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.homeownerId !== req.user.id) {
      return res.status(403).json({ message: 'You can only close your own jobs' });
    }
    if (job.status !== 'PENDING') {
      return res.status(400).json({ message: 'Only pending jobs can be closed' });
    }

    await prisma.job.update({
      where: { id },
      data: { status: 'CLOSED' },
    });

    res.json({ message: 'Job closed', status: 'CLOSED' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createJob,
  getJobById,
  respondToJob,
  getMyJobs,
  getNearbyJobs,
  cancelJob,
  completeJob,
  closeJob,
};

