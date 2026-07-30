const request = require('supertest');
const app = require('../../src/app');

// Replaces the old one-step "tradesperson responds ACCEPTED" flow: a
// tradesperson submits a quote, then the homeowner accepts it. Returns the
// accept response for callers that want to assert on it.
async function quoteAndAccept({ jobId, tradespersonToken, homeownerToken, price = 100 }) {
  const quoteRes = await request(app)
    .post(`/jobs/${jobId}/quote`)
    .set('Authorization', `Bearer ${tradespersonToken}`)
    .send({ price });

  const quotesRes = await request(app)
    .get(`/jobs/${jobId}/quotes`)
    .set('Authorization', `Bearer ${homeownerToken}`);
  const responseId = quotesRes.body[0].id;

  const acceptRes = await request(app)
    .post(`/jobs/${jobId}/quotes/${responseId}/accept`)
    .set('Authorization', `Bearer ${homeownerToken}`);

  return { quoteRes, quotesRes, acceptRes, responseId };
}

module.exports = { quoteAndAccept };
