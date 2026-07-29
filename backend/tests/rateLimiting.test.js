const request = require('supertest');
const app = require('../src/app');

// The rate limiters skip entirely when NODE_ENV === 'test' (so the rest of the
// suite isn't rate-limited). Temporarily switch to a different value for this
// file only, so we can actually exercise the limiter logic, then restore it.
describe('Rate limiting: strict auth vs onboarding buckets are independent', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const email = 'nobody-ratelimit-test@example.com';

  beforeAll(() => {
    process.env.NODE_ENV = 'ratelimit-test';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test('login (max 5) and forgot-password (max 10) have separate budgets', async () => {
    // Use up login's full budget (5) with a nonexistent account — no side
    // effects, just exercises the limiter.
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/auth/login')
        .send({ email, password: 'wrong-password' });
      expect(res.status).toBe(401);
    }

    // forgot-password should be unaffected — separate limiter instance.
    const forgotWhileLoginExhausted = await request(app)
      .post('/auth/forgot-password')
      .send({ email });
    expect(forgotWhileLoginExhausted.status).toBe(200);

    // 6th login request exceeds the strict limiter's cap of 5.
    const blockedLogin = await request(app)
      .post('/auth/login')
      .send({ email, password: 'wrong-password' });
    expect(blockedLogin.status).toBe(429);

    // forgot-password already used 1 of its 10; use up the remaining 9.
    for (let i = 0; i < 9; i++) {
      const res = await request(app)
        .post('/auth/forgot-password')
        .send({ email });
      expect(res.status).toBe(200);
    }

    // 11th forgot-password request exceeds the onboarding limiter's cap of 10.
    const blockedForgotPassword = await request(app)
      .post('/auth/forgot-password')
      .send({ email });
    expect(blockedForgotPassword.status).toBe(429);
  });
});
