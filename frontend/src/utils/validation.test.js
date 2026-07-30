import { describe, test, expect } from 'vitest';
import {
  validateName, validateEmail, validatePassword,
  validateAddressLine1, validateAddressLine2, validateAddressCity, validateAddressPostcode,
  validateTownOrCity, validateJobTitle, validateJobDescription, validateLocationText,
  validateMessageContent, validateReviewComment, getPasswordHint,
} from './validation';

describe('validateName', () => {
  test('rejects empty/whitespace-only', () => {
    expect(validateName('')).toBe('Name is required');
    expect(validateName('   ')).toBe('Name is required');
  });
  test('accepts a normal name', () => {
    expect(validateName('Grace Homeowner')).toBeNull();
  });
  test('rejects a name over 100 characters', () => {
    expect(validateName('a'.repeat(101))).toMatch(/100 characters/);
  });
});

describe('validateEmail', () => {
  test('rejects empty', () => {
    expect(validateEmail('')).toBe('Email is required');
  });
  test('rejects malformed addresses', () => {
    expect(validateEmail('not-an-email')).toMatch(/valid email/);
    expect(validateEmail('missing@domain')).toMatch(/valid email/);
    expect(validateEmail('@nolocal.com')).toMatch(/valid email/);
  });
  test('accepts a valid email', () => {
    expect(validateEmail('alice@example.com')).toBeNull();
  });
  test('rejects an email over 254 characters', () => {
    expect(validateEmail(`${'a'.repeat(250)}@x.com`)).toBe('Email is too long');
  });
});

describe('validatePassword', () => {
  test('rejects empty', () => {
    expect(validatePassword('')).toBe('Password is required');
  });
  test('rejects too short', () => {
    expect(validatePassword('Ab1')).toMatch(/at least 8/);
  });
  test('rejects missing uppercase', () => {
    expect(validatePassword('lowercase123')).toMatch(/uppercase/);
  });
  test('rejects missing lowercase', () => {
    expect(validatePassword('UPPERCASE123')).toMatch(/lowercase/);
  });
  test('rejects missing number', () => {
    expect(validatePassword('NoNumbersHere')).toMatch(/number/);
  });
  test('accepts a valid password', () => {
    expect(validatePassword('Password123')).toBeNull();
  });
});

describe('address validators', () => {
  test('validateAddressLine1 required by default', () => {
    expect(validateAddressLine1('')).toBe('Address line 1 is required');
    expect(validateAddressLine1('', false)).toBeNull();
    expect(validateAddressLine1('42 Example Street')).toBeNull();
  });

  test('validateAddressLine2 is always optional', () => {
    expect(validateAddressLine2('')).toBeNull();
    expect(validateAddressLine2('Flat 3')).toBeNull();
    expect(validateAddressLine2('a'.repeat(256))).toMatch(/255 characters/);
  });

  test('validateAddressCity required by default', () => {
    expect(validateAddressCity('')).toBe('Town or city is required');
    expect(validateAddressCity('', false)).toBeNull();
    expect(validateAddressCity('Glasgow')).toBeNull();
  });

  test('validateAddressPostcode accepts real UK formats', () => {
    for (const pc of ['G2 1AL', 'SW1A 1AA', 'EC1A 1BB', 'M1 1AE', 'B33 8TH', 'CR2 6XH', 'DN55 1PT']) {
      expect(validateAddressPostcode(pc)).toBeNull();
    }
  });

  test('validateAddressPostcode is case-insensitive and tolerates spacing', () => {
    expect(validateAddressPostcode('g2 1al')).toBeNull();
    expect(validateAddressPostcode('G21AL')).toBeNull();
  });

  test('validateAddressPostcode rejects invalid formats', () => {
    expect(validateAddressPostcode('not-a-postcode')).toBe('Enter a valid UK postcode');
    expect(validateAddressPostcode('12345')).toBe('Enter a valid UK postcode');
  });

  test('validateAddressPostcode required by default, optional when told', () => {
    expect(validateAddressPostcode('')).toBe('Postcode is required');
    expect(validateAddressPostcode('', false)).toBeNull();
  });
});

describe('validateTownOrCity', () => {
  test('required by default', () => {
    expect(validateTownOrCity('')).toBe('Town or city is required');
    expect(validateTownOrCity('', false)).toBeNull();
  });
  test('accepts a normal value', () => {
    expect(validateTownOrCity('Glasgow')).toBeNull();
  });
});

describe('job field validators', () => {
  test('validateJobTitle', () => {
    expect(validateJobTitle('')).toBe('Title is required');
    expect(validateJobTitle('Fix leaking tap')).toBeNull();
    expect(validateJobTitle('a'.repeat(141))).toMatch(/140 characters/);
  });

  test('validateJobDescription', () => {
    expect(validateJobDescription('')).toBe('Description is required');
    expect(validateJobDescription('Kitchen tap drips constantly.')).toBeNull();
  });

  test('validateLocationText', () => {
    expect(validateLocationText('')).toBe('Location is required');
    expect(validateLocationText('10 High Street, Glasgow')).toBeNull();
  });
});

describe('validateMessageContent', () => {
  test('rejects empty', () => {
    expect(validateMessageContent('   ')).toBe('Message is required');
  });
  test('accepts normal content', () => {
    expect(validateMessageContent('What time works for you?')).toBeNull();
  });
});

describe('validateReviewComment', () => {
  test('is optional', () => {
    expect(validateReviewComment('')).toBeNull();
    expect(validateReviewComment(undefined)).toBeNull();
  });
  test('rejects over the length limit', () => {
    expect(validateReviewComment('a'.repeat(4001))).toMatch(/4000 characters/);
  });
});

describe('getPasswordHint', () => {
  test('empty password gives no message', () => {
    expect(getPasswordHint('')).toEqual({ valid: false, message: '' });
  });
  test('too short is invalid with a hint', () => {
    const hint = getPasswordHint('Ab1');
    expect(hint.valid).toBe(false);
    expect(hint.message).toMatch(/8 characters/);
  });
  test('missing character classes is invalid with a hint', () => {
    const hint = getPasswordHint('alllowercase1');
    expect(hint.valid).toBe(false);
    expect(hint.message).toMatch(/uppercase/);
  });
  test('a valid password is marked valid', () => {
    expect(getPasswordHint('Password123')).toEqual({ valid: true, message: 'Looks good.' });
  });
});
