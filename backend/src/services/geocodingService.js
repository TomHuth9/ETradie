const axios = require('axios');

// Nominatim (OpenStreetMap) geocoding — free, no API key required.
// Usage policy: https://operations.osmfoundation.org/policies/nominatim/
// We send a User-Agent and keep request volume low (e.g. on registration and job post).
async function geocodeToLatLng(query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new Error('Geocoding requires a non-empty address or place name');
  }

  const url = 'https://nominatim.openstreetmap.org/search';

  const response = await axios.get(url, {
    params: {
      q: query.trim(),
      format: 'json',
      limit: 1,
    },
    headers: {
      'User-Agent': process.env.GEOCODE_USER_AGENT || 'ETradie/1.0 (local development)',
    },
  });

  const result = response.data[0];

  if (!result || result.lat == null || result.lon == null) {
    throw new Error('Unable to geocode location');
  }

  return {
    lat: Number(result.lat),
    lng: Number(result.lon),
  };
}

module.exports = {
  geocodeToLatLng,
};
