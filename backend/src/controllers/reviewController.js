const prisma = require('../prismaClient');

// GET /users/:id/profile — public-ish profile for a user (tradesperson: name, town, rating, categories, availability).
async function getProfile(req, res, next) {
  try {
    const userId = Number(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        townOrCity: true,
        availability: true,
        tradespersonCategories: { select: { category: true } },
      },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const out = {
      id: user.id,
      name: user.name,
      role: user.role,
      townOrCity: user.townOrCity,
      availability: user.availability,
      categories: (user.tradespersonCategories || []).map((tc) => tc.category),
    };

    if (user.role === 'TRADESPERSON') {
      const agg = await prisma.review.aggregate({
        where: { revieweeId: userId },
        _avg: { rating: true },
        _count: { rating: true },
      });
      out.averageRating = agg._avg.rating != null ? Math.round(agg._avg.rating * 10) / 10 : null;
      out.reviewCount = agg._count.rating;
    }

    res.json(out);
  } catch (err) {
    next(err);
  }
}

// Helper: get the other party on the job (homeowner or accepted tradesperson).
async function getJobWithParties(jobId) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      responses: {
        where: { response: 'ACCEPTED' },
        take: 1,
        include: { tradesperson: { select: { id: true } } },
      },
    },
  });
  return job;
}

// POST /jobs/:id/reviews — submit a review (job must be COMPLETED; reviewer rates the other party).
async function submitReview(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { rating, comment } = req.body;

    if (rating == null || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const job = await getJobWithParties(id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.status !== 'COMPLETED') {
      return res.status(400).json({ message: 'You can only review completed jobs' });
    }

    const acceptedTradespersonId = job.responses[0]?.tradesperson?.id;
    if (!acceptedTradespersonId) {
      return res.status(400).json({ message: 'This job has no accepted tradesperson' });
    }

    const reviewerId = req.user.id;
    const isHomeowner = job.homeownerId === reviewerId;
    const isTradesperson = acceptedTradespersonId === reviewerId;

    if (!isHomeowner && !isTradesperson) {
      return res.status(403).json({ message: 'Only the homeowner or the tradesperson who did the job can leave a review' });
    }

    const revieweeId = isHomeowner ? acceptedTradespersonId : job.homeownerId;

    const review = await prisma.review.upsert({
      where: {
        jobId_reviewerId: { jobId: id, reviewerId },
      },
      update: {
        rating: Number(rating),
        comment: comment != null ? String(comment).trim() || null : null,
      },
      create: {
        jobId: id,
        reviewerId,
        revieweeId,
        rating: Number(rating),
        comment: comment != null ? String(comment).trim() || null : null,
      },
      include: {
        reviewee: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(review);
  } catch (err) {
    next(err);
  }
}

// GET /jobs/:id/reviews — list reviews for this job (one from homeowner, one from tradesperson).
async function listReviewsForJob(req, res, next) {
  try {
    const id = Number(req.params.id);
    const job = await prisma.job.findUnique({
      where: { id },
      select: { id: true, homeownerId: true },
      include: {
        responses: {
          where: { response: 'ACCEPTED' },
          take: 1,
          select: { tradespersonId: true },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const reviews = await prisma.review.findMany({
      where: { jobId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        reviewer: { select: { id: true, name: true } },
        reviewee: { select: { id: true, name: true } },
      },
    });

    res.json(reviews);
  } catch (err) {
    next(err);
  }
}

// GET /users/:id/rating — public rating summary for a user (average + count).
async function getRatingForUser(req, res, next) {
  try {
    const userId = Number(req.params.id);

    const agg = await prisma.review.aggregate({
      where: { revieweeId: userId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    res.json({
      averageRating: agg._avg.rating != null ? Math.round(agg._avg.rating * 10) / 10 : null,
      reviewCount: agg._count.rating,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  submitReview,
  listReviewsForJob,
  getRatingForUser,
  getProfile,
};
