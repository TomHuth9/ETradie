const request = require('supertest');
const app = require('../../src/app');

// Registration no longer logs the user in directly — it creates an unverified
// account and emails a 6-digit code. In non-production, the response also
// includes devVerificationCode so tests can complete the flow without a mailbox.
async function registerAndVerify(payload) {
  const registerRes = await request(app).post('/auth/register').send(payload);
  const verifyRes = await request(app)
    .post('/auth/verify-email')
    .send({ email: registerRes.body.email, code: registerRes.body.devVerificationCode });
  return { registerRes, verifyRes };
}

module.exports = { registerAndVerify };
