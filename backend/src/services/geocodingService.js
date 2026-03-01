const axios = require('axios');

const OPENCAGE_API_KEY = process.env.OPENCAGE_API_KEY;

// Lightweight helper around the OpenCage geocoding API.
// We keep this in a single place so it's easy to mock or swap later.
async function geocodeToLatLng(query) {
  if (!OPENCAGE_API_KEY) {
    throw new Error('OPENCAGE_API_KEY is not set in environment variables');
  }

  const url = 'https://api.opencagedata.com/geocode/v1/json';

  const response = await axios.get(url, {
    params: {
      q: query,
      key: OPENCAGE_API_KEY,
      limit: 1,
    },
  });

  const result = response.data.results[0];

  if (!result || !result.geometry) {
    throw new Error('Unable to geocode location');
  }

  return {
    lat: result.geometry.lat,
    lng: result.geometry.lng,
  };
}

module.exports = {
  geocodeToLatLng,
};

