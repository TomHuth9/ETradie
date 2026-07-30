const { validateEnv } = require('../src/utils/validateEnv');

describe('validateEnv', () => {
  const originalEnv = { ...process.env };
  let exitSpy, errorSpy, warnSpy;

  beforeEach(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    exitSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  test('passes silently when everything is set', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.JWT_SECRET = 'secret';
    process.env.SENDGRID_API_KEY = 'SG.x';
    process.env.FROM_EMAIL = 'noreply@example.com';
    process.env.CLIENT_URL = 'https://example.com';

    validateEnv();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('exits with a clear message when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    process.env.JWT_SECRET = 'secret';

    validateEnv();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('DATABASE_URL'));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('exits with a clear message when JWT_SECRET is missing', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    delete process.env.JWT_SECRET;

    validateEnv();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('JWT_SECRET'));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('lists every missing required variable together, not just the first', () => {
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;

    validateEnv();

    const message = errorSpy.mock.calls[0][0];
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('JWT_SECRET');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('warns but does not exit when only a recommended variable is missing', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.JWT_SECRET = 'secret';
    delete process.env.SENDGRID_API_KEY;
    process.env.FROM_EMAIL = 'noreply@example.com';
    process.env.CLIENT_URL = 'https://example.com';

    validateEnv();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SENDGRID_API_KEY'));
  });
});
