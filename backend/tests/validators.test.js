const {
  registerSchema,
  loginSchema,
  createJobSchema,
  submitReviewSchema,
} = require('../src/validators/schemas');

describe('Validation schemas', () => {
  test('registerSchema rejects weak password and missing address/town', () => {
    const result = registerSchema.safeParse({
      body: {
        name: '',
        email: 'not-an-email',
        password: 'short',
        role: 'homeowner',
        addressLine1: '',
        townOrCity: '',
      },
    });
    expect(result.success).toBe(false);
  });

  test('registerSchema accepts valid homeowner payload', () => {
    const result = registerSchema.safeParse({
      body: {
        name: 'Alice Homeowner',
        email: 'alice@example.com',
        password: 'Password123',
        role: 'homeowner',
        addressLine1: '10 High Street',
        addressCity: 'Glasgow',
        addressPostcode: 'G1 1AA',
      },
    });
    expect(result.success).toBe(true);
  });

  test('registerSchema rejects an invalid UK postcode', () => {
    const result = registerSchema.safeParse({
      body: {
        name: 'Alice Homeowner',
        email: 'alice@example.com',
        password: 'Password123',
        role: 'homeowner',
        addressLine1: '10 High Street',
        addressCity: 'Glasgow',
        addressPostcode: 'not-a-postcode',
      },
    });
    expect(result.success).toBe(false);
  });

  test('loginSchema requires email and password', () => {
    const bad = loginSchema.safeParse({ body: { email: 'bad', password: '' } });
    expect(bad.success).toBe(false);

    const ok = loginSchema.safeParse({
      body: { email: 'bob@example.com', password: 'anything' },
    });
    expect(ok.success).toBe(true);
  });

  test('createJobSchema enforces title/description/location and category', () => {
    const bad = createJobSchema.safeParse({
      body: {
        title: '',
        description: '',
        category: 'PLUMBING',
        locationText: '',
      },
    });
    expect(bad.success).toBe(false);

    const ok = createJobSchema.safeParse({
      body: {
        title: 'Fix boiler',
        description: 'Boiler is leaking, needs repair.',
        category: 'HEATING_BOILERS',
        locationText: '10 High Street, Glasgow',
      },
    });
    expect(ok.success).toBe(true);
  });

  test('submitReviewSchema enforces rating 1-5', () => {
    const badLow = submitReviewSchema.safeParse({
      params: { id: '1' },
      body: { rating: 0, comment: 'bad' },
    });
    const badHigh = submitReviewSchema.safeParse({
      params: { id: '1' },
      body: { rating: 6, comment: 'too good' },
    });
    const ok = submitReviewSchema.safeParse({
      params: { id: '1' },
      body: { rating: 5, comment: 'Great job' },
    });

    expect(badLow.success).toBe(false);
    expect(badHigh.success).toBe(false);
    expect(ok.success).toBe(true);
  });
});

