const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/prismaClient');
const { hashToken } = require('../src/utils/hashToken');

describe('E2E: verification codes and reset tokens are hashed at rest', () => {
  const password = 'Password123';

  test('emailVerificationCode is stored as a bcrypt hash, not the raw code', async () => {
    const email = `hash-code-${Date.now()}@example.com`;
    const reg = await request(app).post('/auth/register').send({
      name: 'Hash Code Test', email, password, role: 'homeowner',
      addressLine1: '10 High Street', addressCity: 'Glasgow', addressPostcode: 'G1 1AA',
    });
    const rawCode = reg.body.devVerificationCode;
    expect(rawCode).toMatch(/^\d{6}$/);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user.emailVerificationCode).not.toBe(rawCode);
    // bcrypt hash format: $2a$/$2b$ etc., 60 characters.
    expect(user.emailVerificationCode).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(user.emailVerificationCode).toHaveLength(60);

    // The raw code from the email/dev-response still verifies correctly
    // against the stored hash.
    const verify = await request(app).post('/auth/verify-email').send({ email, code: rawCode });
    expect(verify.status).toBe(200);
  });

  test('a resent verification code is also hashed, and invalidates the previous one', async () => {
    const email = `hash-resend-${Date.now()}@example.com`;
    const reg = await request(app).post('/auth/register').send({
      name: 'Hash Resend Test', email, password, role: 'homeowner',
      addressLine1: '10 High Street', addressCity: 'Glasgow', addressPostcode: 'G1 1AA',
    });
    const oldRawCode = reg.body.devVerificationCode;

    const resend = await request(app).post('/auth/resend-verification').send({ email });
    const newRawCode = resend.body.devVerificationCode;
    expect(newRawCode).not.toBe(oldRawCode);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user.emailVerificationCode).toMatch(/^\$2[aby]\$\d{2}\$/);

    const oldCodeAttempt = await request(app).post('/auth/verify-email').send({ email, code: oldRawCode });
    expect(oldCodeAttempt.status).toBe(400);

    const newCodeAttempt = await request(app).post('/auth/verify-email').send({ email, code: newRawCode });
    expect(newCodeAttempt.status).toBe(200);
  });

  test('passwordResetToken is stored as a SHA-256 hash, not the raw token', async () => {
    const email = `hash-token-${Date.now()}@example.com`;
    await request(app).post('/auth/register').send({
      name: 'Hash Token Test', email, password, role: 'homeowner',
      addressLine1: '10 High Street', addressCity: 'Glasgow', addressPostcode: 'G1 1AA',
    });

    const forgot = await request(app).post('/auth/forgot-password').send({ email });
    const rawToken = forgot.body.resetToken;
    expect(rawToken).toBeTruthy();

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user.passwordResetToken).not.toBe(rawToken);
    expect(user.passwordResetToken).toBe(hashToken(rawToken));
    // SHA-256 hex digest: 64 characters.
    expect(user.passwordResetToken).toHaveLength(64);

    // The raw token from the email/dev-response still works for the actual reset.
    const reset = await request(app)
      .post('/auth/reset-password')
      .send({ token: rawToken, newPassword: 'BrandNewPassword789' });
    expect(reset.status).toBe(200);
  });

  test('a raw token guessed/leaked without hashing does not match the stored hash', async () => {
    const email = `hash-mismatch-${Date.now()}@example.com`;
    await request(app).post('/auth/register').send({
      name: 'Hash Mismatch Test', email, password, role: 'homeowner',
      addressLine1: '10 High Street', addressCity: 'Glasgow', addressPostcode: 'G1 1AA',
    });
    await request(app).post('/auth/forgot-password').send({ email });

    // Even if an attacker read the DB directly and tried to use the stored
    // hash itself as the "token" (rather than the raw value only the emailed
    // link contains), it must not work.
    const user = await prisma.user.findUnique({ where: { email } });
    const attempt = await request(app)
      .post('/auth/reset-password')
      .send({ token: user.passwordResetToken, newPassword: 'ShouldNotWork123' });
    expect(attempt.status).toBe(400);
  });
});
