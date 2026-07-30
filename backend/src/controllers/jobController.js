const prisma = require('../prismaClient');
const { geocodeToLatLng } = require('../services/geocodingService');
const { haversineDistanceKm } = require('../utils/haversine');
const { createNotification } = require('../services/notificationService');
const { sendNewJobMatchEmail } = require('../services/emailService');

const NEARBY_RADIUS_KM = 25;

// Finds tradespeople within NEARBY_RADIUS_KM of a job whose selected trade
// categories include the job's category (tradespeople with no categories set
// are treated as open to all categories, matching the /jobs/nearby behaviour).
async function findMatchingTradespeople(job) {
  if (job.lat == null || job.lng == null) return [];

  const tradespeople = await prisma.user.findMany({
    where: { role: 'TRADESPERSON', lat: { not: null }, lng: { not: null } },
    include: { tradespersonCategories: { select: { category: true } } },
  });

  return tradespeople.filter((tp) => {
    const distance = haversineDistanceKm(job.lat, job.lng, tp.lat, tp.lng);
    if (distance > NEARBY_RADIUS_KM) return false;
    const categories = tp.tradespersonCategories.map((c) => c.category);
    if (categories.length > 0 && !categories.includes(job.category)) return false;
    return true;
  });
}

// Emails matching tradespeople about a new job. Fire-and-forget — never
// awaited by the request handler, so a slow/failed send can't delay or break
// job posting. Skipped in tests to avoid spamming real inboxes and burning
// SendGrid quota, since test-mode geocoding returns identical dummy
// coordinates for every user/job (everything would "match").
async function notifyMatchingTradespeopleByEmail(job) {
  if (process.env.NODE_ENV === 'test') return;
  try {
    const matches = await findMatchingTradespeople(job);
    await Promise.allSettled(
      matches.map((tp) =>
        sendNewJobMatchEmail(tp.email, job).catch((err) => {
          console.error(`New-job-match email failed for user ${tp.id}:`, err?.response?.body ?? err.message);
        })
      )
    );
  } catch (err) {
    console.error('New-job-match email matching failed:', err.message);
  }
}

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

    // Email nearby matching tradespeople too, so they're reached even if
    // offline. Not awaited — see notifyMatchingTradespeopleByEmail comment.
    notifyMatchingTradespeopleByEmail(job);

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
// Access control:
//   HOMEOWNER  — only their own job.
//   TRADESPERSON — PENDING jobs (reachable via nearby feed) or jobs they have responded to.
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

    if (req.user.role === 'HOMEOWNER') {
      if (job.homeownerId !== req.user.id) {
        return res.status(403).json({ message: 'Not authorised' });
      }
    } else if (req.user.role === 'TRADESPERSON') {
      const myResponse = await prisma.jobResponse.findUnique({
        where: {
          jobId_tradespersonId: { jobId: id, tradespersonId: req.user.id },
        },
      });

      // Allow access to PENDING jobs (they appear in the nearby feed) and to
      // any job this tradesperson has already responded to.
      if (job.status !== 'PENDING' && !myResponse) {
        return res.status(403).json({ message: 'Not authorised' });
      }

      // Let the frontend show "you already quoted £X" without a second call.
      job.myResponse = myResponse;
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

// POST /jobs/:id/quote
// Tradesperson submits (or updates) a price quote for a pending job. The job
// stays PENDING and open to further quotes — the homeowner decides who gets
// it via acceptQuote below, rather than a first-to-respond race.
async function submitQuote(req, res, next) {
  try {
    if (req.user.role !== 'TRADESPERSON') {
      return res.status(403).json({ message: 'Only tradespeople can submit quotes' });
    }

    const id = Number(req.params.id);
    const { price, message } = req.body;

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    if (job.status !== 'PENDING') {
      return res.status(400).json({ message: 'This job is no longer accepting quotes' });
    }

    const jobResponse = await prisma.jobResponse.upsert({
      where: { jobId_tradespersonId: { jobId: id, tradespersonId: req.user.id } },
      update: { response: 'QUOTED', price, message: message || null, respondedAt: new Date() },
      create: { jobId: id, tradespersonId: req.user.id, response: 'QUOTED', price, message: message || null },
    });

    await createNotification(req, {
      userId: job.homeownerId,
      type: 'quote_received',
      message: `New quote on \"${job.title}\"`,
      link: `/jobs/${id}`,
    });

    res.json(jobResponse);
  } catch (err) {
    next(err);
  }
}

// POST /jobs/:id/decline
// Tradesperson declines to quote on a job.
async function declineJob(req, res, next) {
  try {
    if (req.user.role !== 'TRADESPERSON') {
      return res.status(403).json({ message: 'Only tradespeople can decline jobs' });
    }

    const id = Number(req.params.id);
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const jobResponse = await prisma.jobResponse.upsert({
      where: { jobId_tradespersonId: { jobId: id, tradespersonId: req.user.id } },
      update: { response: 'DECLINED' },
      create: { jobId: id, tradespersonId: req.user.id, response: 'DECLINED' },
    });

    res.json(jobResponse);
  } catch (err) {
    next(err);
  }
}

// GET /jobs/:id/quotes — homeowner reviews every response (quoted, declined,
// etc.) on their own job, with each tradesperson's rating attached.
async function listQuotesForJob(req, res, next) {
  try {
    const id = Number(req.params.id);
    const job = await prisma.job.findUnique({ where: { id }, select: { id: true, homeownerId: true } });
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    if (req.user.role !== 'HOMEOWNER' || job.homeownerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorised' });
    }

    const responses = await prisma.jobResponse.findMany({
      where: { jobId: id },
      orderBy: { respondedAt: 'asc' },
      include: { tradesperson: { select: { id: true, name: true } } },
    });

    // One grouped aggregate for every tradesperson on this job, rather than
    // one query per row — avoids an N+1 as the number of quotes grows.
    const tradespersonIds = responses.map((r) => r.tradespersonId);
    const ratings = tradespersonIds.length
      ? await prisma.review.groupBy({
          by: ['revieweeId'],
          where: { revieweeId: { in: tradespersonIds } },
          _avg: { rating: true },
          _count: { rating: true },
        })
      : [];
    const ratingByUserId = new Map(ratings.map((r) => [r.revieweeId, r]));

    const payload = responses.map((r) => {
      const rating = ratingByUserId.get(r.tradespersonId);
      return {
        id: r.id,
        response: r.response,
        price: r.price,
        message: r.message,
        respondedAt: r.respondedAt,
        tradesperson: {
          id: r.tradesperson.id,
          name: r.tradesperson.name,
          averageRating: rating?._avg.rating != null ? Math.round(rating._avg.rating * 10) / 10 : null,
          reviewCount: rating?._count.rating ?? 0,
        },
      };
    });

    res.json(payload);
  } catch (err) {
    next(err);
  }
}

// POST /jobs/:id/quotes/:responseId/accept — homeowner picks a quote.
async function acceptQuote(req, res, next) {
  try {
    if (req.user.role !== 'HOMEOWNER') {
      return res.status(403).json({ message: 'Only homeowners can accept a quote' });
    }

    const id = Number(req.params.id);
    const responseId = Number(req.params.responseId);

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    if (job.homeownerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorised' });
    }

    const chosen = await prisma.jobResponse.findUnique({ where: { id: responseId } });
    if (!chosen || chosen.jobId !== id || chosen.response !== 'QUOTED') {
      return res.status(400).json({ message: 'Quote not found or no longer available' });
    }

    // Atomically transition PENDING → ACCEPTED first. A WHERE status = 'PENDING'
    // updateMany means only one concurrent accept can ever match — the
    // database enforces this without a separate read (no TOCTOU race).
    const updated = await prisma.job.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'ACCEPTED' },
    });
    if (updated.count === 0) {
      return res.status(409).json({ message: 'This job is no longer available' });
    }

    await prisma.$transaction([
      prisma.jobResponse.update({ where: { id: responseId }, data: { response: 'ACCEPTED' } }),
      prisma.jobResponse.updateMany({
        where: { jobId: id, response: 'QUOTED', id: { not: responseId } },
        data: { response: 'NOT_SELECTED' },
      }),
    ]);

    await createNotification(req, {
      userId: chosen.tradespersonId,
      type: 'quote_accepted',
      message: `Your quote on \"${job.title}\" was accepted`,
      link: `/jobs/${id}`,
    });

    const notSelected = await prisma.jobResponse.findMany({
      where: { jobId: id, response: 'NOT_SELECTED' },
      select: { tradespersonId: true },
    });
    await Promise.all(
      notSelected.map((r) =>
        createNotification(req, {
          userId: r.tradespersonId,
          type: 'quote_not_selected',
          message: `The homeowner chose another quote for \"${job.title}\"`,
          link: `/jobs/${id}`,
        })
      )
    );

    res.json({ message: 'Quote accepted', status: 'ACCEPTED' });
  } catch (err) {
    next(err);
  }
}

// GET /jobs/nearby — tradesperson: pending jobs within 25km they haven't responded to.
async function getNearbyJobs(req, res, next) {
  try {
    if (req.user.role !== 'TRADESPERSON') {
      return res.status(403).json({ message: 'Only tradespeople can fetch nearby jobs' });
    }

    const categoryFilter = req.query.category; // optional: filter by trade category
    const radiusKm = req.query.radiusKm ?? NEARBY_RADIUS_KM; // optional: tradesperson-adjustable search radius

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
      if (distance > radiusKm) return false;
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
  submitQuote,
  declineJob,
  listQuotesForJob,
  acceptQuote,
  getMyJobs,
  getNearbyJobs,
  cancelJob,
  completeJob,
  closeJob,
};

