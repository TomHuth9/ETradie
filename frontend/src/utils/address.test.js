import { describe, test, expect } from 'vitest';
import { formatAddress } from './address';

describe('formatAddress', () => {
  test('joins all four parts with a comma', () => {
    expect(formatAddress({
      addressLine1: '42 Example Street',
      addressLine2: 'Flat 3',
      addressCity: 'Glasgow',
      addressPostcode: 'G1 1AA',
    })).toBe('42 Example Street, Flat 3, Glasgow, G1 1AA');
  });

  test('omits addressLine2 when absent', () => {
    expect(formatAddress({
      addressLine1: '42 Example Street',
      addressCity: 'Glasgow',
      addressPostcode: 'G1 1AA',
    })).toBe('42 Example Street, Glasgow, G1 1AA');
  });

  test('trims whitespace on each part', () => {
    expect(formatAddress({
      addressLine1: '  42 Example Street  ',
      addressCity: ' Glasgow ',
      addressPostcode: ' G1 1AA ',
    })).toBe('42 Example Street, Glasgow, G1 1AA');
  });

  test('skips empty-string and whitespace-only parts', () => {
    expect(formatAddress({
      addressLine1: '42 Example Street',
      addressLine2: '   ',
      addressCity: 'Glasgow',
      addressPostcode: '',
    })).toBe('42 Example Street, Glasgow');
  });

  test('returns an empty string when nothing is provided', () => {
    expect(formatAddress({})).toBe('');
  });

  test('ignores non-string values instead of throwing', () => {
    expect(formatAddress({
      addressLine1: '42 Example Street',
      addressLine2: null,
      addressCity: undefined,
      addressPostcode: 'G1 1AA',
    })).toBe('42 Example Street, G1 1AA');
  });
});
