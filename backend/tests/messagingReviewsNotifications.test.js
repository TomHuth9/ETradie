const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/prismaClient');
const { registerAndVerify } = require('./helpers/registerAndVerify');
const { quoteAndAccept } = require('./helpers/quoteAndAccept');

describe('E2E: messaging, reviews, notifications, and public profile', () => {
  const password = 'Password123';
  const suffix = Date.now();

  let homeownerToken, homeownerId;
  let tradespersonToken, tradespersonId;
  let outsiderToken; // a second tradesperson uninvolved in the job below
  let pendingJobId; // never accepted — used for "not a participant yet" checks
  let acceptedJobId; // accepted, then completed partway through the suite

  beforeAll(async () => {
    const hw = await registerAndVerify({
      name: 'MRN Homeowner', email: `mrn-hw-${suffix}@example.com`, password, role: 'homeowner',
      addressLine1: '10 High Street', addressCity: 'Glasgow', addressPostcode: 'G1 1AA',
    });
    homeownerToken = hw.verifyRes.body.token;
    homeownerId = hw.verifyRes.body.user.id;

    const ts = await registerAndVerify({
      name: 'MRN Tradesperson', email: `mrn-ts-${suffix}@example.com`, password, role: 'tradesperson', townOrCity: 'Glasgow',
    });
    tradespersonToken = ts.verifyRes.body.token;
    tradespersonId = ts.verifyRes.body.user.id;

    const outsider = await registerAndVerify({
      name: 'MRN Outsider', email: `mrn-out-${suffix}@example.com`, password, role: 'tradesperson', townOrCity: 'Glasgow',
    });
    outsiderToken = outsider.verifyRes.body.token;

    const pendingJob = await request(app)
      .post('/jobs')
      .set('Authorization', `Bearer ${homeownerToken}`)
      .send({ title: 'Pending job', description: 'Not yet accepted.', category: 'PLUMBING', locationText: '10 High Street, Glasgow' });
    pendingJobId = pendingJob.body.id;

    const acceptedJob = await request(app)
      .post('/jobs')
      .set('Authorization', `Bearer ${homeownerToken}`)
      .send({ title: 'Accepted job', description: 'Will be accepted then completed.', category: 'PLUMBING', locationText: '10 High Street, Glasgow' });
    acceptedJobId = acceptedJob.body.id;

    await quoteAndAccept({ jobId: acceptedJobId, tradespersonToken, homeownerToken, price: 150 });
  });

  describe('messaging', () => {
    test('cannot list or send messages on a job that has not been accepted yet', async () => {
      const list = await request(app)
        .get(`/jobs/${pendingJobId}/messages`)
        .set('Authorization', `Bearer ${homeownerToken}`);
      expect(list.status).toBe(404);

      const send = await request(app)
        .post(`/jobs/${pendingJobId}/messages`)
        .set('Authorization', `Bearer ${homeownerToken}`)
        .send({ content: 'Hello?' });
      expect(send.status).toBe(404);
    });

    test('a non-participant cannot list or send messages on an accepted job', async () => {
      const list = await request(app)
        .get(`/jobs/${acceptedJobId}/messages`)
        .set('Authorization', `Bearer ${outsiderToken}`);
      expect(list.status).toBe(404);

      const send = await request(app)
        .post(`/jobs/${acceptedJobId}/messages`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ content: 'Can I butt in?' });
      expect(send.status).toBe(404);
    });

    test('rejects empty message content', async () => {
      const res = await request(app)
        .post(`/jobs/${acceptedJobId}/messages`)
        .set('Authorization', `Bearer ${homeownerToken}`)
        .send({ content: '   ' });
      expect(res.status).toBe(400);
    });

    test('homeowner and accepted tradesperson can exchange messages', async () => {
      const fromHomeowner = await request(app)
        .post(`/jobs/${acceptedJobId}/messages`)
        .set('Authorization', `Bearer ${homeownerToken}`)
        .send({ content: 'What time works for you?' });
      expect(fromHomeowner.status).toBe(201);
      expect(fromHomeowner.body.content).toBe('What time works for you?');
      expect(fromHomeowner.body.sender.id).toBe(homeownerId);

      const fromTradesperson = await request(app)
        .post(`/jobs/${acceptedJobId}/messages`)
        .set('Authorization', `Bearer ${tradespersonToken}`)
        .send({ content: 'Tomorrow morning works.' });
      expect(fromTradesperson.status).toBe(201);

      const list = await request(app)
        .get(`/jobs/${acceptedJobId}/messages`)
        .set('Authorization', `Bearer ${homeownerToken}`);
      expect(list.status).toBe(200);
      expect(list.body).toHaveLength(2);
      expect(list.body[0].content).toBe('What time works for you?');
      expect(list.body[1].content).toBe('Tomorrow morning works.');
    });

    test('sending a message notifies the other participant', async () => {
      const notifs = await request(app)
        .get('/notifications')
        .set('Authorization', `Bearer ${tradespersonToken}`);
      expect(notifs.status).toBe(200);
      expect(notifs.body.some((n) => n.type === 'message')).toBe(true);
    });
  });

  describe('reviews', () => {
    test('cannot review a job that is not yet completed', async () => {
      const res = await request(app)
        .post(`/jobs/${acceptedJobId}/reviews`)
        .set('Authorization', `Bearer ${homeownerToken}`)
        .send({ rating: 5, comment: 'Too early' });
      expect(res.status).toBe(400);
    });

    test('completes the job so reviews can be submitted', async () => {
      const res = await request(app)
        .post(`/jobs/${acceptedJobId}/complete`)
        .set('Authorization', `Bearer ${homeownerToken}`);
      expect(res.status).toBe(200);
    });

    test('an uninvolved user cannot review a completed job', async () => {
      const res = await request(app)
        .post(`/jobs/${acceptedJobId}/reviews`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ rating: 5, comment: 'Not my job' });
      expect(res.status).toBe(403);
    });

    test('rejects an out-of-range rating', async () => {
      const res = await request(app)
        .post(`/jobs/${acceptedJobId}/reviews`)
        .set('Authorization', `Bearer ${homeownerToken}`)
        .send({ rating: 6, comment: 'Too high' });
      expect(res.status).toBe(400);
    });

    test('homeowner reviews the tradesperson, tradesperson reviews the homeowner', async () => {
      const fromHomeowner = await request(app)
        .post(`/jobs/${acceptedJobId}/reviews`)
        .set('Authorization', `Bearer ${homeownerToken}`)
        .send({ rating: 5, comment: 'Great work' });
      expect(fromHomeowner.status).toBe(201);
      expect(fromHomeowner.body.reviewee.id).toBe(tradespersonId);

      const fromTradesperson = await request(app)
        .post(`/jobs/${acceptedJobId}/reviews`)
        .set('Authorization', `Bearer ${tradespersonToken}`)
        .send({ rating: 4, comment: 'Good communication' });
      expect(fromTradesperson.status).toBe(201);
      expect(fromTradesperson.body.reviewee.id).toBe(homeownerId);
    });

    test('submitting a second review from the same reviewer updates it instead of duplicating', async () => {
      const updated = await request(app)
        .post(`/jobs/${acceptedJobId}/reviews`)
        .set('Authorization', `Bearer ${homeownerToken}`)
        .send({ rating: 3, comment: 'Actually just okay' });
      expect(updated.status).toBe(201);
      expect(updated.body.rating).toBe(3);

      const list = await request(app)
        .get(`/jobs/${acceptedJobId}/reviews`)
        .set('Authorization', `Bearer ${homeownerToken}`);
      const fromHomeowner = list.body.filter((r) => r.reviewer.id === homeownerId);
      expect(fromHomeowner).toHaveLength(1);
      expect(fromHomeowner[0].rating).toBe(3);
    });

    test('public rating and profile reflect the received review', async () => {
      // The homeowner's review of the tradesperson was updated to 3 in the
      // previous test (upsert), so that's the rating that should be reflected.
      const rating = await request(app)
        .get(`/users/${tradespersonId}/rating`)
        .set('Authorization', `Bearer ${homeownerToken}`);
      expect(rating.status).toBe(200);
      expect(rating.body.reviewCount).toBe(1);
      expect(rating.body.averageRating).toBe(3);

      const profile = await request(app)
        .get(`/users/${tradespersonId}/profile`)
        .set('Authorization', `Bearer ${homeownerToken}`);
      expect(profile.status).toBe(200);
      expect(profile.body.role).toBe('TRADESPERSON');
      expect(profile.body.reviewCount).toBe(1);
      expect(profile.body.averageRating).toBe(3);

      const reviewsForUser = await request(app)
        .get(`/users/${tradespersonId}/reviews`)
        .set('Authorization', `Bearer ${homeownerToken}`);
      expect(reviewsForUser.status).toBe(200);
      expect(reviewsForUser.body).toHaveLength(1);
      expect(reviewsForUser.body[0].rating).toBe(3);
    });

    test('leaving a review notifies the reviewee', async () => {
      const notifs = await request(app)
        .get('/notifications')
        .set('Authorization', `Bearer ${tradespersonToken}`);
      expect(notifs.body.some((n) => n.type === 'review')).toBe(true);
    });

    test('getProfile 404s for a nonexistent user', async () => {
      const res = await request(app)
        .get('/users/999999999/profile')
        .set('Authorization', `Bearer ${homeownerToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('notifications', () => {
    test('a user only ever sees their own notifications', async () => {
      const tradespersonNotifs = await request(app)
        .get('/notifications')
        .set('Authorization', `Bearer ${tradespersonToken}`);
      expect(tradespersonNotifs.status).toBe(200);
      expect(tradespersonNotifs.body.length).toBeGreaterThan(0);

      // Confirm at the DB level none of the tradesperson's notifications belong to someone else.
      const rows = await prisma.notification.findMany({ where: { id: { in: tradespersonNotifs.body.map((n) => n.id) } } });
      expect(rows.every((n) => n.userId === tradespersonId)).toBe(true);
    });

    test('cannot mark someone else\'s notification as read', async () => {
      const mine = await request(app).get('/notifications').set('Authorization', `Bearer ${tradespersonToken}`);
      const notifId = mine.body[0].id;

      const res = await request(app)
        .post(`/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${outsiderToken}`);
      expect(res.status).toBe(404);
    });

    test('can mark your own notification as read', async () => {
      const mine = await request(app).get('/notifications').set('Authorization', `Bearer ${tradespersonToken}`);
      const notifId = mine.body.find((n) => !n.readAt).id;

      const res = await request(app)
        .post(`/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${tradespersonToken}`);
      expect(res.status).toBe(200);
      expect(res.body.readAt).not.toBeNull();
    });

    test('mark-all-read clears every unread notification', async () => {
      const before = await request(app).get('/notifications').set('Authorization', `Bearer ${tradespersonToken}`);
      expect(before.body.some((n) => !n.readAt)).toBe(true);

      const markAll = await request(app)
        .post('/notifications/read-all')
        .set('Authorization', `Bearer ${tradespersonToken}`);
      expect(markAll.status).toBe(200);

      const after = await request(app).get('/notifications').set('Authorization', `Bearer ${tradespersonToken}`);
      expect(after.body.every((n) => n.readAt)).toBe(true);
    });
  });
});
