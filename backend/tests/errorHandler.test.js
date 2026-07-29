const errorHandler = require('../src/middleware/errorHandler');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('errorHandler', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    consoleErrorSpy.mockRestore();
  });

  test('hides the real message for an unexpected (500) error in production', () => {
    process.env.NODE_ENV = 'production';
    const res = mockRes();
    const err = new Error('relation "User" does not exist — raw Prisma detail');

    errorHandler(err, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Something went wrong' });
  });

  test('shows the real message for an unexpected error outside production, for debugging', () => {
    process.env.NODE_ENV = 'test';
    const res = mockRes();
    const err = new Error('relation "User" does not exist — raw Prisma detail');

    errorHandler(err, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'relation "User" does not exist — raw Prisma detail' });
  });

  test('an error with a deliberately-set status keeps its specific message even in production', () => {
    process.env.NODE_ENV = 'production';
    const res = mockRes();
    const err = new Error('Only homeowners can create jobs');
    err.status = 403;

    errorHandler(err, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Only homeowners can create jobs' });
  });

  test('falls back to a generic message when the error has no message at all', () => {
    process.env.NODE_ENV = 'production';
    const res = mockRes();

    errorHandler({}, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Something went wrong' });
  });

  test('still logs the full original error server-side even when the client response is hidden', () => {
    process.env.NODE_ENV = 'production';
    const res = mockRes();
    const err = new Error('sensitive internal detail');

    errorHandler(err, {}, res, () => {});

    expect(consoleErrorSpy).toHaveBeenCalledWith(err);
  });
});
