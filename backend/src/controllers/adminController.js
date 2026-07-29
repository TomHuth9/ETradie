const prisma = require('../prismaClient');
const { deleteUserAndAllData } = require('../services/userDeletionService');

const PAGE_SIZE = 20;

function parsePage(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || PAGE_SIZE));
  return { page, limit, skip: (page - 1) * limit };
}

// GET /admin/jobs?page=1&limit=20&status=PENDING
async function getAllJobs(req, res, next) {
  try {
    const { page, limit, skip } = parsePage(req.query);
    const where = {};
    if (req.query.status) where.status = req.query.status;

    const [jobs, total] = await prisma.$transaction([
      prisma.job.findMany({
        where,
        include: {
          homeowner: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.job.count({ where }),
    ]);

    res.json({ jobs, total, page, limit });
  } catch (err) {
    next(err);
  }
}

// GET /admin/users?page=1&limit=20&role=HOMEOWNER
async function getAllUsers(req, res, next) {
  try {
    const { page, limit, skip } = parsePage(req.query);
    const where = {};
    if (req.query.role) where.role = req.query.role;

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          isOnline: true,
          townOrCity: true,
          addressLine1: true,
          addressLine2: true,
          addressCity: true,
          addressPostcode: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page, limit });
  } catch (err) {
    next(err);
  }
}

// DELETE /admin/users/:id
async function deleteUser(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid user id' });
    if (id === req.user.id) return res.status(400).json({ message: 'Cannot delete your own account' });

    await deleteUserAndAllData(id);

    res.json({ message: 'User deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'User not found' });
    next(err);
  }
}

module.exports = { getAllJobs, getAllUsers, deleteUser };
