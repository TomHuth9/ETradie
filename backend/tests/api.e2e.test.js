const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/prismaClient');

describe('E2E: auth and basic homeowner flow', () => {
  const uniqueEmail = `test+${Date.now()}@example.com`;
  const password = 'Password123';

  afterAll(async () => {
    // Clean up test user and any jobs they created.
    try {
      await prisma.job.deleteMany({
        where: { homeowner: { email: uniqueEmail } },
      });
      await prisma.user.deleteMany({ where: { email: uniqueEmail } });
    } finally {
      await prisma.$disconnect();
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

    // Fetch trade categories (no auth required but good sanity check)
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

