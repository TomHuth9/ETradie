import axios from 'axios';

// Central Axios instance so we configure baseURL and headers only once.
const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export default api;

