const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/prismaClient');

describe('E2E: auth and basic homeowner flow', () => {
  const uniqueEmail = `test+${Date.now()}@example.com`;
  const password = 'Password123';

  afterAll(async () => {
    try {
      await prisma.job.deleteMany({
        where: { homeowner: { email: uniqueEmail } },
      });
      await prisma.user.deleteMany({ where: { email: uniqueEmail } });
    } catch (_) {
    }
  });

  test('health endpoint works', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });

  test('can register, login, post a job, and fetch my jobs', async () => {
    // Register homeowner
    const registerRes = await request(app)
      .post('/auth/register')
      .send({
        name: 'Test Homeowner',
        email: uniqueEmail,
        password,
        role: 'homeowner',
        address: '10 High Street, Glasgow',
      });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body).toHaveProperty('token');
    expect(registerRes.body.user).toMatchObject({
      email: uniqueEmail.toLowerCase(),
      role: 'HOMEOWNER',
    });

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: uniqueEmail, password });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('token');
    const token = loginRes.body.token;

    // Fetch trade categories
    const categoriesRes = await request(app).get('/trades/categories');
    expect(categoriesRes.status).toBe(200);
    expect(Array.isArray(categoriesRes.body)).toBe(true);
    expect(categoriesRes.body.length).toBeGreaterThan(0);

    // Create a job as homeowner
    const jobRes = await request(app)
      .post('/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Fix leaking radiator',
        description: 'Radiator is leaking slightly, please investigate.',
        category: 'PLUMBING',
        locationText: '10 High Street, Glasgow',
      });

    expect(jobRes.status).toBe(201);
    expect(jobRes.body).toHaveProperty('id');
    const jobId = jobRes.body.id;

    // Fetch /jobs/my and ensure the new job appears
    const myJobsRes = await request(app)
      .get('/jobs/my')
      .set('Authorization', `Bearer ${token}`);

    expect(myJobsRes.status).toBe(200);
    const jobsPayload = myJobsRes.body;
    const jobs = Array.isArray(jobsPayload.jobs)
      ? jobsPayload.jobs
      : Array.isArray(jobsPayload)
      ? jobsPayload
      : [];

    expect(jobs.some((j) => j.id === jobId)).toBe(true);
  });
});

describe('E2E: tradesperson sees nearby job', () => {
  const homeownerEmail = `test-homeowner-${Date.now()}@example.com`;
  const tradespersonEmail = `test-tradesperson-${Date.now()}@example.com`;
  const password = 'Password123';

  afterAll(async () => {
    try {
      await prisma.job.deleteMany({
        where: { homeowner: { email: homeownerEmail } },
      });
      await prisma.user.deleteMany({
        where: {
          email: { in: [homeownerEmail.toLowerCase(), tradespersonEmail.toLowerCase()] },
        },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  test('homeowner posts job, tradesperson fetches it via /jobs/nearby', async () => {
    // Register homeowner and create a job
    const regHome = await request(app)
      .post('/auth/register')
      .send({
        name: 'Test Homeowner',
        email: homeownerEmail,
        password,
        role: 'homeowner',
        address: '10 High Street, Glasgow',
      });
    expect(regHome.status).toBe(201);
    const homeownerToken = regHome.body.token;

    const jobRes = await request(app)
      .post('/jobs')
      .set('Authorization', `Bearer ${homeownerToken}`)
      .send({
        title: 'Fix boiler',
        description: 'Boiler not heating.',
        category: 'HEATING_BOILERS',
        locationText: '10 High Street, Glasgow',
      });
    expect(jobRes.status).toBe(201);
    const jobId = jobRes.body.id;

    // Register tradesperson (same area so geocoding in test gives same coords = nearby)
    const regTrade = await request(app)
      .post('/auth/register')
      .send({
        name: 'Test Tradesperson',
        email: tradespersonEmail,
        password,
        role: 'tradesperson',
        townOrCity: 'Glasgow',
      });
    expect(regTrade.status).toBe(201);
    const tradespersonToken = regTrade.body.token;

    const nearbyRes = await request(app)
      .get('/jobs/nearby')
      .set('Authorization', `Bearer ${tradespersonToken}`);

    expect(nearbyRes.status).toBe(200);
    expect(Array.isArray(nearbyRes.body)).toBe(true);
    const nearby = nearbyRes.body;
    expect(nearby.some((j) => j.id === jobId)).toBe(true);
    const job = nearby.find((j) => j.id === jobId);
    expect(job).toMatchObject({
      title: 'Fix boiler',
      category: 'HEATING_BOILERS',
    });
  });
});

