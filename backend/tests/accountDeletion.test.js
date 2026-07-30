const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/prismaClient');
const { registerAndVerify } = require('./helpers/registerAndVerify');
const { quoteAndAccept } = require('./helpers/quoteAndAccept');

describe('E2E: self-service account deletion', () => {
  const password = 'Password123';

  test('rejects deletion with the wrong password, then deletes on the correct one', async () => {
    const email = `del-basic-${Date.now()}@example.com`;
    const { verifyRes } = await registerAndVerify({
      name: 'Delete Basic', email, password, role: 'homeowner',
      addressLine1: '10 High Street', addressCity: 'Glasgow', addressPostcode: 'G1 1AA',
    });
    const token = verifyRes.body.token;

    const wrongPw = await request(app)
      .delete('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'NotThePassword123' });
    expect(wrongPw.status).toBe(401);

    const del = await request(app)
      .delete('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: password });
    expect(del.status).toBe(200);

    // Token is now orphaned — authMiddleware rejects it (user no longer
    // exists) before the request ever reaches getMe's own check.
    const meAfter = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(meAfter.status).toBe(401);

    const loginAfter = await request(app).post('/auth/login').send({ email, password });
    expect(loginAfter.status).toBe(401);
  });

  test('deletes a homeowner and cascades to their posted job', async () => {
    const email = `del-job-${Date.now()}@example.com`;
    const { verifyRes } = await registerAndVerify({
      name: 'Delete Job Owner', email, password, role: 'homeowner',
      addressLine1: '10 High Street', addressCity: 'Glasgow', addressPostcode: 'G1 1AA',
    });
    const token = verifyRes.body.token;

    const jobRes = await request(app)
      .post('/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Job to be cascade-deleted',
        description: 'Should be removed along with the account.',
        category: 'PLUMBING',
        locationText: '10 High Street, Glasgow',
      });
    expect(jobRes.status).toBe(201);
    const jobId = jobRes.body.id;

    const del = await request(app)
      .delete('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: password });
    expect(del.status).toBe(200);

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    expect(job).toBeNull();
  });

  // Regression test: the previous admin delete-user implementation only cleaned
  // up jobs a user posted as a homeowner. A tradesperson who had responded to
  // someone else's job would hit a foreign key violation (P2003) on deletion,
  // since JobResponse.tradesperson doesn't cascade at the DB level.
  test('deletes a tradesperson who responded to another user\'s job, without touching that job', async () => {
    const hwEmail = `del-hw-${Date.now()}@example.com`;
    const tsEmail = `del-ts-${Date.now()}@example.com`;

    const { verifyRes: hwVerify } = await registerAndVerify({
      name: 'Persisting Homeowner', email: hwEmail, password, role: 'homeowner',
      addressLine1: '10 High Street', addressCity: 'Glasgow', addressPostcode: 'G1 1AA',
    });
    const hwToken = hwVerify.body.token;

    const jobRes = await request(app)
      .post('/jobs')
      .set('Authorization', `Bearer ${hwToken}`)
      .send({
        title: 'Job the tradesperson will respond to',
        description: 'Tests cascade cleanup on the responder side.',
        category: 'PLUMBING',
        locationText: '10 High Street, Glasgow',
      });
    const jobId = jobRes.body.id;

    const { verifyRes: tsVerify } = await registerAndVerify({
      name: 'Deleting Tradesperson', email: tsEmail, password, role: 'tradesperson', townOrCity: 'Glasgow',
    });
    const tsToken = tsVerify.body.token;
    const tsId = tsVerify.body.user.id;

    const { acceptRes } = await quoteAndAccept({ jobId, tradespersonToken: tsToken, homeownerToken: hwToken, price: 150 });
    expect(acceptRes.status).toBe(200);

    // This used to throw a P2003 foreign key violation before the shared
    // deleteUserAndAllData helper existed.
    const del = await request(app)
      .delete('/auth/me')
      .set('Authorization', `Bearer ${tsToken}`)
      .send({ currentPassword: password });
    expect(del.status).toBe(200);

    // The homeowner's job must be untouched — deleting the responder should
    // never cascade into data owned by someone else.
    const jobAfter = await prisma.job.findUnique({ where: { id: jobId } });
    expect(jobAfter).not.toBeNull();
    expect(jobAfter.status).toBe('ACCEPTED');

    // The JobResponse row tied to the deleted tradesperson should be gone.
    const orphanedResponse = await prisma.jobResponse.findUnique({
      where: { jobId_tradespersonId: { jobId, tradespersonId: tsId } },
    });
    expect(orphanedResponse).toBeNull();
  });

  test('rejects deletion without a password', async () => {
    const email = `del-nopw-${Date.now()}@example.com`;
    const { verifyRes } = await registerAndVerify({
      name: 'No Password Delete', email, password, role: 'homeowner',
      addressLine1: '10 High Street', addressCity: 'Glasgow', addressPostcode: 'G1 1AA',
    });
    const token = verifyRes.body.token;

    const res = await request(app)
      .delete('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('rejects deletion without auth', async () => {
    const res = await request(app).delete('/auth/me').send({ currentPassword: password });
    expect(res.status).toBe(401);
  });
});

describe('E2E: admin delete-user uses the same cascade cleanup', () => {
  const password = 'Password123';

  // Same regression as the self-service test above, but via the admin
  // endpoint (adminController.deleteUser), which previously had its own
  // separate — and incomplete — cleanup logic.
  test('admin can delete a tradesperson who responded to another user\'s job', async () => {
    const hwEmail = `admin-del-hw-${Date.now()}@example.com`;
    const tsEmail = `admin-del-ts-${Date.now()}@example.com`;
    const adminEmail = `admin-del-admin-${Date.now()}@example.com`;

    const { verifyRes: hwVerify } = await registerAndVerify({
      name: 'Admin Test Homeowner', email: hwEmail, password, role: 'homeowner',
      addressLine1: '10 High Street', addressCity: 'Glasgow', addressPostcode: 'G1 1AA',
    });
    const hwToken = hwVerify.body.token;

    const jobRes = await request(app)
      .post('/jobs')
      .set('Authorization', `Bearer ${hwToken}`)
      .send({
        title: 'Job for admin-delete regression test',
        description: 'Tests admin cascade cleanup on the responder side.',
        category: 'PLUMBING',
        locationText: '10 High Street, Glasgow',
      });
    const jobId = jobRes.body.id;

    const { verifyRes: tsVerify } = await registerAndVerify({
      name: 'Admin-Deleted Tradesperson', email: tsEmail, password, role: 'tradesperson', townOrCity: 'Glasgow',
    });
    const tsToken = tsVerify.body.token;
    const tsId = tsVerify.body.user.id;

    await quoteAndAccept({ jobId, tradespersonToken: tsToken, homeownerToken: hwToken, price: 150 });

    const { verifyRes: adminVerify } = await registerAndVerify({
      name: 'Admin User', email: adminEmail, password, role: 'homeowner',
      addressLine1: '10 High Street', addressCity: 'Glasgow', addressPostcode: 'G1 1AA',
    });
    await prisma.user.update({ where: { email: adminEmail }, data: { role: 'ADMIN' } });
    const adminLogin = await request(app).post('/auth/login').send({ email: adminEmail, password });
    const adminToken = adminLogin.body.token;

    // This used to throw a P2003 foreign key violation before adminController
    // switched to the shared deleteUserAndAllData helper.
    const del = await request(app)
      .delete(`/admin/users/${tsId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(200);

    const jobAfter = await prisma.job.findUnique({ where: { id: jobId } });
    expect(jobAfter).not.toBeNull();
  });
});
