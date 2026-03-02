const { haversineDistanceKm } = require('../src/utils/haversine');

describe('haversineDistanceKm', () => {
  test('returns zero for identical coordinates', () => {
    const d = haversineDistanceKm(55.86, -4.25, 55.86, -4.25);
    expect(d).toBeCloseTo(0, 5);
  });

  test('returns a positive distance between two cities', () => {
    // Glasgow approx (55.8642, -4.2518), Edinburgh approx (55.9533, -3.1883)
    const d = haversineDistanceKm(55.8642, -4.2518, 55.9533, -3.1883);
    expect(d).toBeGreaterThan(60);
    expect(d).toBeLessThan(90);
  });
});

