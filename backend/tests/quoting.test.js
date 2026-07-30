const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/prismaClient');
const { registerAndVerify } = require('./helpers/registerAndVerify');

const password = 'Password123';

async function makeHomeowner(suffix) {
  const { verifyRes } = await registerAndVerify({
    name: 'Quoting Homeowner', email: `quote-hw-${suffix}@example.com`, password, role: 'homeowner',
    addressLine1: '10 High Street', addressCity: 'Glasgow', addressPostcode: 'G1 1AA',
  });
  return verifyRes.body;
}

async function makeTradesperson(suffix) {
  const { verifyRes } = await registerAndVerify({
    name: 'Quoting Tradesperson', email: `quote-ts-${suffix}@example.com`, password, role: 'tradesperson', townOrCity: 'Glasgow',
  });
  return verifyRes.body;
}

async function postJob(homeownerToken, overrides = {}) {
  const res = await request(app)
    .post('/jobs')
    .set('Authorization', `Bearer ${homeownerToken}`)
    .send({
      title: 'Fix leaking radiator', description: 'Radiator drips.', category: 'PLUMBING',
      locationText: '10 High Street, Glasgow',
      ...overrides,
    });
  return res.body.id;
}

describe('E2E: quoting system', () => {
  describe('submitting a quote', () => {
    test('a tradesperson can submit a quote on a pending job', async () => {
      const suffix = Date.now();
      const homeowner = await makeHomeowner(suffix);
      const trade = await makeTradesperson(suffix);
      const jobId = await postJob(homeowner.token);

      const res = await request(app)
        .post(`/jobs/${jobId}/quote`)
        .set('Authorization', `Bearer ${trade.token}`)
        .send({ price: 150, message: 'Can start Tuesday' });

      expect(res.status).toBe(200);
      expect(res.body.response).toBe('QUOTED');
      expect(Number(res.body.price)).toBe(150);
      expect(res.body.message).toBe('Can start Tuesday');

      // The job stays open for more quotes — it's not auto-accepted.
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job.status).toBe('PENDING');
    });

    test('rejects a non-positive price', async () => {
      const suffix = Date.now();
      const homeowner = await makeHomeowner(suffix);
      const trade = await makeTradesperson(suffix);
      const jobId = await postJob(homeowner.token);

      const res = await request(app)
        .post(`/jobs/${jobId}/quote`)
        .set('Authorization', `Bearer ${trade.token}`)
        .send({ price: 0 });

      expect(res.status).toBe(400);
    });

    test('only tradespeople can submit a quote', async () => {
      const suffix = Date.now();
      const homeowner = await makeHomeowner(suffix);
      const jobId = await postJob(homeowner.token);

      const res = await request(app)
        .post(`/jobs/${jobId}/quote`)
        .set('Authorization', `Bearer ${homeowner.token}`)
        .send({ price: 150 });

      expect(res.status).toBe(403);
    });

    test('cannot quote on a job that is no longer pending', async () => {
      const suffix = Date.now();
      const homeowner = await makeHomeowner(suffix);
      const trade1 = await makeTradesperson(`${suffix}-a`);
      const trade2 = await makeTradesperson(`${suffix}-b`);
      const jobId = await postJob(homeowner.token);

      await request(app).post(`/jobs/${jobId}/quote`).set('Authorization', `Bearer ${trade1.token}`).send({ price: 100 });
      const quotes = await request(app).get(`/jobs/${jobId}/quotes`).set('Authorization', `Bearer ${homeowner.token}`);
      await request(app)
        .post(`/jobs/${jobId}/quotes/${quotes.body[0].id}/accept`)
        .set('Authorization', `Bearer ${homeowner.token}`);

      const lateQuote = await request(app)
        .post(`/jobs/${jobId}/quote`)
        .set('Authorization', `Bearer ${trade2.token}`)
        .send({ price: 90 });

      expect(lateQuote.status).toBe(400);
    });

    test('resubmitting a quote updates the existing one rather than duplicating it', async () => {
      const suffix = Date.now();
      const homeowner = await makeHomeowner(suffix);
      const trade = await makeTradesperson(suffix);
      const jobId = await postJob(homeowner.token);

      await request(app).post(`/jobs/${jobId}/quote`).set('Authorization', `Bearer ${trade.token}`).send({ price: 150 });
      const updated = await request(app).post(`/jobs/${jobId}/quote`).set('Authorization', `Bearer ${trade.token}`).send({ price: 120 });
      expect(updated.status).toBe(200);

      const rows = await prisma.jobResponse.findMany({ where: { jobId } });
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].price)).toBe(120);
    });

    test('submitting a quote notifies the homeowner', async () => {
      const suffix = Date.now();
      const homeowner = await makeHomeowner(suffix);
      const trade = await makeTradesperson(suffix);
      const jobId = await postJob(homeowner.token);

      await request(app).post(`/jobs/${jobId}/quote`).set('Authorization', `Bearer ${trade.token}`).send({ price: 150 });

      const notifs = await request(app).get('/notifications').set('Authorization', `Bearer ${homeowner.token}`);
      expect(notifs.body.some((n) => n.type === 'quote_received')).toBe(true);
    });
  });

  describe('declining a job', () => {
    test('a tradesperson can decline without a price', async () => {
      const suffix = Date.now();
      const homeowner = await makeHomeowner(suffix);
      const trade = await makeTradesperson(suffix);
      const jobId = await postJob(homeowner.token);

      const res = await request(app)
        .post(`/jobs/${jobId}/decline`)
        .set('Authorization', `Bearer ${trade.token}`);

      expect(res.status).toBe(200);
      expect(res.body.response).toBe('DECLINED');
    });
  });

  describe('listing quotes', () => {
    test('only the owning homeowner can view quotes for a job', async () => {
      const suffix = Date.now();
      const homeowner = await makeHomeowner(suffix);
      const otherHomeowner = await makeHomeowner(`${suffix}-other`);
      const trade = await makeTradesperson(suffix);
      const jobId = await postJob(homeowner.token);
      await request(app).post(`/jobs/${jobId}/quote`).set('Authorization', `Bearer ${trade.token}`).send({ price: 150 });

      const asTrade = await request(app).get(`/jobs/${jobId}/quotes`).set('Authorization', `Bearer ${trade.token}`);
      expect(asTrade.status).toBe(403);

      const asOtherHomeowner = await request(app).get(`/jobs/${jobId}/quotes`).set('Authorization', `Bearer ${otherHomeowner.token}`);
      expect(asOtherHomeowner.status).toBe(403);

      const asOwner = await request(app).get(`/jobs/${jobId}/quotes`).set('Authorization', `Bearer ${homeowner.token}`);
      expect(asOwner.status).toBe(200);
      expect(asOwner.body).toHaveLength(1);
    });

    test('quotes include each tradesperson\'s rating', async () => {
      const suffix = Date.now();
      const homeowner = await makeHomeowner(suffix);
      const trade = await makeTradesperson(suffix);
      const jobId = await postJob(homeowner.token);

      // Give the tradesperson a rating via a separate, already-completed job.
      const ratingJobId = await postJob(homeowner.token, { title: 'Earlier job' });
      await request(app).post(`/jobs/${ratingJobId}/quote`).set('Authorization', `Bearer ${trade.token}`).send({ price: 80 });
      const ratingQuotes = await request(app).get(`/jobs/${ratingJobId}/quotes`).set('Authorization', `Bearer ${homeowner.token}`);
      await request(app).post(`/jobs/${ratingJobId}/quotes/${ratingQuotes.body[0].id}/accept`).set('Authorization', `Bearer ${homeowner.token}`);
      await request(app).post(`/jobs/${ratingJobId}/complete`).set('Authorization', `Bearer ${homeowner.token}`);
      await request(app).post(`/jobs/${ratingJobId}/reviews`).set('Authorization', `Bearer ${homeowner.token}`).send({ rating: 4 });

      await request(app).post(`/jobs/${jobId}/quote`).set('Authorization', `Bearer ${trade.token}`).send({ price: 150 });
      const quotes = await request(app).get(`/jobs/${jobId}/quotes`).set('Authorization', `Bearer ${homeowner.token}`);

      expect(quotes.body[0].tradesperson.averageRating).toBe(4);
      expect(quotes.body[0].tradesperson.reviewCount).toBe(1);
    });
  });

  describe('accepting a quote', () => {
    test('accepting a quote assigns the job and marks other quotes not-selected', async () => {
      const suffix = Date.now();
      const homeowner = await makeHomeowner(suffix);
      const winner = await makeTradesperson(`${suffix}-winner`);
      const loser = await makeTradesperson(`${suffix}-loser`);
      const jobId = await postJob(homeowner.token);

      await request(app).post(`/jobs/${jobId}/quote`).set('Authorization', `Bearer ${winner.token}`).send({ price: 150 });
      await request(app).post(`/jobs/${jobId}/quote`).set('Authorization', `Bearer ${loser.token}`).send({ price: 200 });

      const quotes = await request(app).get(`/jobs/${jobId}/quotes`).set('Authorization', `Bearer ${homeowner.token}`);
      const winningResponse = quotes.body.find((q) => q.tradesperson.id === winner.user.id);

      const accept = await request(app)
        .post(`/jobs/${jobId}/quotes/${winningResponse.id}/accept`)
        .set('Authorization', `Bearer ${homeowner.token}`);
      expect(accept.status).toBe(200);

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job.status).toBe('ACCEPTED');

      const rows = await prisma.jobResponse.findMany({ where: { jobId } });
      const winnerRow = rows.find((r) => r.tradespersonId === winner.user.id);
      const loserRow = rows.find((r) => r.tradespersonId === loser.user.id);
      expect(winnerRow.response).toBe('ACCEPTED');
      expect(loserRow.response).toBe('NOT_SELECTED');
    });

    test('only the owning homeowner can accept a quote', async () => {
      const suffix = Date.now();
      const homeowner = await makeHomeowner(suffix);
      const otherHomeowner = await makeHomeowner(`${suffix}-other`);
      const trade = await makeTradesperson(suffix);
      const jobId = await postJob(homeowner.token);
      await request(app).post(`/jobs/${jobId}/quote`).set('Authorization', `Bearer ${trade.token}`).send({ price: 150 });
      const quotes = await request(app).get(`/jobs/${jobId}/quotes`).set('Authorization', `Bearer ${homeowner.token}`);

      const res = await request(app)
        .post(`/jobs/${jobId}/quotes/${quotes.body[0].id}/accept`)
        .set('Authorization', `Bearer ${otherHomeowner.token}`);
      expect(res.status).toBe(403);
    });

    test('cannot accept the same job twice (second accept is rejected)', async () => {
      const suffix = Date.now();
      const homeowner = await makeHomeowner(suffix);
      const trade1 = await makeTradesperson(`${suffix}-a`);
      const trade2 = await makeTradesperson(`${suffix}-b`);
      const jobId = await postJob(homeowner.token);

      await request(app).post(`/jobs/${jobId}/quote`).set('Authorization', `Bearer ${trade1.token}`).send({ price: 150 });
      await request(app).post(`/jobs/${jobId}/quote`).set('Authorization', `Bearer ${trade2.token}`).send({ price: 160 });
      const quotes = await request(app).get(`/jobs/${jobId}/quotes`).set('Authorization', `Bearer ${homeowner.token}`);
      const [first, second] = quotes.body;

      const firstAccept = await request(app)
        .post(`/jobs/${jobId}/quotes/${first.id}/accept`)
        .set('Authorization', `Bearer ${homeowner.token}`);
      expect(firstAccept.status).toBe(200);

      const secondAccept = await request(app)
        .post(`/jobs/${jobId}/quotes/${second.id}/accept`)
        .set('Authorization', `Bearer ${homeowner.token}`);
      expect(secondAccept.status).toBe(400);
    });

    test('notifies the winner and the not-selected tradespeople', async () => {
      const suffix = Date.now();
      const homeowner = await makeHomeowner(suffix);
      const winner = await makeTradesperson(`${suffix}-winner`);
      const loser = await makeTradesperson(`${suffix}-loser`);
      const jobId = await postJob(homeowner.token);

      await request(app).post(`/jobs/${jobId}/quote`).set('Authorization', `Bearer ${winner.token}`).send({ price: 150 });
      await request(app).post(`/jobs/${jobId}/quote`).set('Authorization', `Bearer ${loser.token}`).send({ price: 200 });
      const quotes = await request(app).get(`/jobs/${jobId}/quotes`).set('Authorization', `Bearer ${homeowner.token}`);
      const winningResponse = quotes.body.find((q) => q.tradesperson.id === winner.user.id);

      await request(app)
        .post(`/jobs/${jobId}/quotes/${winningResponse.id}/accept`)
        .set('Authorization', `Bearer ${homeowner.token}`);

      const winnerNotifs = await request(app).get('/notifications').set('Authorization', `Bearer ${winner.token}`);
      expect(winnerNotifs.body.some((n) => n.type === 'quote_accepted')).toBe(true);

      const loserNotifs = await request(app).get('/notifications').set('Authorization', `Bearer ${loser.token}`);
      expect(loserNotifs.body.some((n) => n.type === 'quote_not_selected')).toBe(true);
    });
  });

  describe('getJobById includes the tradesperson\'s own response', () => {
    test('shows the submitted quote back to the tradesperson who made it', async () => {
      const suffix = Date.now();
      const homeowner = await makeHomeowner(suffix);
      const trade = await makeTradesperson(suffix);
      const jobId = await postJob(homeowner.token);
      await request(app).post(`/jobs/${jobId}/quote`).set('Authorization', `Bearer ${trade.token}`).send({ price: 150, message: 'Tuesday works' });

      const res = await request(app).get(`/jobs/${jobId}`).set('Authorization', `Bearer ${trade.token}`);
      expect(res.status).toBe(200);
      expect(res.body.myResponse.response).toBe('QUOTED');
      expect(Number(res.body.myResponse.price)).toBe(150);
    });

    test('is null for a tradesperson who has not responded yet', async () => {
      const suffix = Date.now();
      const homeowner = await makeHomeowner(suffix);
      const trade = await makeTradesperson(suffix);
      const jobId = await postJob(homeowner.token);

      const res = await request(app).get(`/jobs/${jobId}`).set('Authorization', `Bearer ${trade.token}`);
      expect(res.status).toBe(200);
      expect(res.body.myResponse).toBeNull();
    });
  });

  describe('adjustable search radius on /jobs/nearby', () => {
    test('rejects a radiusKm outside the allowed range', async () => {
      const suffix = Date.now();
      const trade = await makeTradesperson(suffix);

      const tooSmall = await request(app).get('/jobs/nearby?radiusKm=0').set('Authorization', `Bearer ${trade.token}`);
      expect(tooSmall.status).toBe(400);

      const tooLarge = await request(app).get('/jobs/nearby?radiusKm=500').set('Authorization', `Bearer ${trade.token}`);
      expect(tooLarge.status).toBe(400);
    });

    test('accepts a valid radiusKm and still returns matching jobs', async () => {
      const suffix = Date.now();
      const homeowner = await makeHomeowner(suffix);
      const trade = await makeTradesperson(suffix);
      const jobId = await postJob(homeowner.token);

      const res = await request(app).get('/jobs/nearby?radiusKm=10').set('Authorization', `Bearer ${trade.token}`);
      expect(res.status).toBe(200);
      expect(res.body.some((j) => j.id === jobId)).toBe(true);
    });
  });
});
