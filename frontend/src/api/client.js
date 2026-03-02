import axios from 'axios';

// Central Axios instance so we configure baseURL and headers only once.
const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Apply persisted auth header as early as possible (before any component effects run).
try {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('etradie_auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      const token = parsed?.token;
      if (token) {
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
      }
    }
  }
} catch {
  // ignore malformed storage
}

export default api;

