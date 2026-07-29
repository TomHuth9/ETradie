const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/prismaClient');
const { registerAndVerify } = require('./helpers/registerAndVerify');

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

  test('can register, verify email, login, post a job, and fetch my jobs', async () => {
    // Register homeowner (unverified — code emailed, returned in dev/test response)
    const registerRes = await request(app)
      .post('/auth/register')
      .send({
        name: 'Test Homeowner',
        email: uniqueEmail,
        password,
        role: 'homeowner',
        addressLine1: '10 High Street',
        addressCity: 'Glasgow',
        addressPostcode: 'G1 1AA',
      });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body).not.toHaveProperty('token');
    expect(registerRes.body.email).toBe(uniqueEmail.toLowerCase());

    // Login is rejected until the account is verified
    const loginBeforeVerify = await request(app)
      .post('/auth/login')
      .send({ email: uniqueEmail, password });
    expect(loginBeforeVerify.status).toBe(403);
    expect(loginBeforeVerify.body.code).toBe('EMAIL_NOT_VERIFIED');

    const verifyRes = await request(app)
      .post('/auth/verify-email')
      .send({ email: registerRes.body.email, code: registerRes.body.devVerificationCode });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body).toHaveProperty('token');
    expect(verifyRes.body.user).toMatchObject({
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

describe('E2E: admin endpoints', () => {
  const homeownerEmail = `test-hw-admin-${Date.now()}@example.com`;
  const adminEmail = `test-admin-${Date.now()}@example.com`;
  const password = 'Password123';
  let homeownerToken;
  let adminToken;

  beforeAll(async () => {
    const hw = await registerAndVerify({ name: 'Test HW', email: homeownerEmail, password, role: 'homeowner', addressLine1: '10 High Street', addressCity: 'Glasgow', addressPostcode: 'G1 1AA' });
    homeownerToken = hw.verifyRes.body.token;

    await registerAndVerify({ name: 'Test Admin', email: adminEmail, password, role: 'homeowner', addressLine1: '10 High Street', addressCity: 'Glasgow', addressPostcode: 'G1 1AA' });

    await prisma.user.update({ where: { email: adminEmail }, data: { role: 'ADMIN' } });

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: adminEmail, password });
    adminToken = loginRes.body.token;
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({ where: { email: { in: [homeownerEmail, adminEmail] } } });
    } catch (_) {}
  });

  test('non-admin (homeowner) is rejected with 403 on admin endpoints', async () => {
    const jobsRes = await request(app)
      .get('/admin/jobs')
      .set('Authorization', `Bearer ${homeownerToken}`);
    expect(jobsRes.status).toBe(403);

    const usersRes = await request(app)
      .get('/admin/users')
      .set('Authorization', `Bearer ${homeownerToken}`);
    expect(usersRes.status).toBe(403);
  });

  test('admin /users response excludes sensitive fields', async () => {
    const res = await request(app)
      .get('/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    for (const user of res.body.users) {
      expect(user).not.toHaveProperty('passwordHash');
      expect(user).not.toHaveProperty('passwordResetToken');
    }
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
    // Register + verify homeowner and create a job
    const { registerRes: regHome, verifyRes: verifyHome } = await registerAndVerify({
      name: 'Test Homeowner',
      email: homeownerEmail,
      password,
      role: 'homeowner',
      addressLine1: '10 High Street',
      addressCity: 'Glasgow',
      addressPostcode: 'G1 1AA',
    });
    expect(regHome.status).toBe(201);
    const homeownerToken = verifyHome.body.token;

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

    // Register + verify tradesperson (same area so geocoding in test gives same coords = nearby)
    const { registerRes: regTrade, verifyRes: verifyTrade } = await registerAndVerify({
      name: 'Test Tradesperson',
      email: tradespersonEmail,
      password,
      role: 'tradesperson',
      townOrCity: 'Glasgow',
    });
    expect(regTrade.status).toBe(201);
    const tradespersonToken = verifyTrade.body.token;

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

