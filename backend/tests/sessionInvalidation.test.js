const request = require('supertest');
const app = require('../src/app');
const { registerAndVerify } = require('./helpers/registerAndVerify');

describe('E2E: password change/reset invalidates existing tokens (tokenVersion)', () => {
  const password = 'Password123';
  const newPassword = 'NewPassword456';

  test('changing your password invalidates the old token but the freshly-returned token keeps working', async () => {
    const email = `sess-change-${Date.now()}@example.com`;
    const { verifyRes } = await registerAndVerify({
      name: 'Session Change', email, password, role: 'homeowner',
      addressLine1: '10 High Street', addressCity: 'Glasgow', addressPostcode: 'G1 1AA',
    });
    const oldToken = verifyRes.body.token;

    // Old token works before the change.
    const meBefore = await request(app).get('/auth/me').set('Authorization', `Bearer ${oldToken}`);
    expect(meBefore.status).toBe(200);

    const change = await request(app)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ currentPassword: password, newPassword });
    expect(change.status).toBe(200);
    expect(change.body).toHaveProperty('token');
    const newToken = change.body.token;
    expect(newToken).not.toBe(oldToken);

    // The token used to make the change is now invalid...
    const meWithOldToken = await request(app).get('/auth/me').set('Authorization', `Bearer ${oldToken}`);
    expect(meWithOldToken.status).toBe(401);

    // ...but the freshly-issued token works, so the current session isn't kicked out.
    const meWithNewToken = await request(app).get('/auth/me').set('Authorization', `Bearer ${newToken}`);
    expect(meWithNewToken.status).toBe(200);

    // And the new password actually works for a fresh login.
    const login = await request(app).post('/auth/login').send({ email, password: newPassword });
    expect(login.status).toBe(200);
  });

  test('a failed password-change attempt (wrong current password) does not invalidate the existing token', async () => {
    const email = `sess-failed-${Date.now()}@example.com`;
    const { verifyRes } = await registerAndVerify({
      name: 'Session Failed Change', email, password, role: 'homeowner',
      addressLine1: '10 High Street', addressCity: 'Glasgow', addressPostcode: 'G1 1AA',
    });
    const token = verifyRes.body.token;

    const change = await request(app)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'TotallyWrongPassword1', newPassword });
    expect(change.status).toBe(401);

    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
  });

  test('invalidation is per-user — changing one account\'s password does not affect another\'s token', async () => {
    const emailA = `sess-a-${Date.now()}@example.com`;
    const emailB = `sess-b-${Date.now()}@example.com`;

    const a = await registerAndVerify({
      name: 'Session User A', email: emailA, password, role: 'homeowner',
      addressLine1: '10 High Street', addressCity: 'Glasgow', addressPostcode: 'G1 1AA',
    });
    const b = await registerAndVerify({
      name: 'Session User B', email: emailB, password, role: 'homeowner',
      addressLine1: '10 High Street', addressCity: 'Glasgow', addressPostcode: 'G1 1AA',
    });
    const tokenA = a.verifyRes.body.token;
    const tokenB = b.verifyRes.body.token;

    await request(app)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ currentPassword: password, newPassword });

    const meA = await request(app).get('/auth/me').set('Authorization', `Bearer ${tokenA}`);
    expect(meA.status).toBe(401); // A's old token is invalid

    const meB = await request(app).get('/auth/me').set('Authorization', `Bearer ${tokenB}`);
    expect(meB.status).toBe(200); // B is completely unaffected
  });

  test('resetting your password via the forgot-password flow invalidates existing tokens', async () => {
    const email = `sess-reset-${Date.now()}@example.com`;
    const { verifyRes } = await registerAndVerify({
      name: 'Session Reset', email, password, role: 'homeowner',
      addressLine1: '10 High Street', addressCity: 'Glasgow', addressPostcode: 'G1 1AA',
    });
    const oldToken = verifyRes.body.token;

    const forgot = await request(app).post('/auth/forgot-password').send({ email });
    expect(forgot.status).toBe(200);
    const resetToken = forgot.body.resetToken; // dev-mode only, see profileController.forgotPassword
    expect(resetToken).toBeTruthy();

    const reset = await request(app)
      .post('/auth/reset-password')
      .send({ token: resetToken, newPassword });
    expect(reset.status).toBe(200);

    const meWithOldToken = await request(app).get('/auth/me').set('Authorization', `Bearer ${oldToken}`);
    expect(meWithOldToken.status).toBe(401);

    const login = await request(app).post('/auth/login').send({ email, password: newPassword });
    expect(login.status).toBe(200);
  });
});
