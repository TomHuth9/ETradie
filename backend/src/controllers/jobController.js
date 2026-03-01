const prisma = require('../prismaClient');
const { geocodeToLatLng } = require('../services/geocodingService');

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
      },
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
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

    if (response !== 'accepted' && response !== 'declined') {
      return res
        .status(400)
        .json({ message: 'response must be accepted or declined' });
    }

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const prismaResponse =
      response === 'accepted' ? 'ACCEPTED' : 'DECLINED';

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

// GET /jobs/my
// Homeowner: jobs they created.
// Tradesperson: jobs they have responded to.
async function getMyJobs(req, res, next) {
  try {
    if (req.user.role === 'HOMEOWNER') {
      const jobs = await prisma.job.findMany({
        where: { homeownerId: req.user.id },
        orderBy: { createdAt: 'desc' },
      });

      return res.json(jobs);
    }

    if (req.user.role === 'TRADESPERSON') {
      const responses = await prisma.jobResponse.findMany({
        where: { tradespersonId: req.user.id },
        include: {
          job: true,
        },
        orderBy: { respondedAt: 'desc' },
      });

      const jobs = responses.map((r) => r.job);
      return res.json(jobs);
    }

    return res.status(400).json({ message: 'Unknown user role' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createJob,
  getJobById,
  respondToJob,
  getMyJobs,
};

