const prisma = require('../prismaClient');

// Deletes a user and everything tied to them, in any role (homeowner,
// tradesperson, reviewer/reviewee, message sender). Job, JobResponse, Message
// and Review don't cascade on the User relation at the DB level (see
// schema.prisma), so those are cleaned up explicitly, in dependency order,
// before the user row itself. Wrapped in a transaction so a failure partway
// through rolls back instead of leaving orphaned data.
async function deleteUserAndAllData(userId) {
  await prisma.$transaction(async (tx) => {
    const jobs = await tx.job.findMany({ where: { homeownerId: userId }, select: { id: true } });
    const jobIds = jobs.map((j) => j.id);

    await tx.review.deleteMany({
      where: { OR: [{ jobId: { in: jobIds } }, { reviewerId: userId }, { revieweeId: userId }] },
    });
    await tx.message.deleteMany({
      where: { OR: [{ jobId: { in: jobIds } }, { senderId: userId }] },
    });
    await tx.jobResponse.deleteMany({
      where: { OR: [{ jobId: { in: jobIds } }, { tradespersonId: userId }] },
    });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.job.deleteMany({ where: { homeownerId: userId } });
    await tx.tradespersonCategory.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });
}

module.exports = { deleteUserAndAllData };
