import axios from 'axios';
import { beginRequest, endRequest, coalesceReads, cacheReads } from './requestActivity';

const api = axios.create({
  baseURL: '/api',
});

const clearPendingReads = coalesceReads(api, () => localStorage.getItem('access') || 'anonymous');
const clearCachedReads = cacheReads(api, () => localStorage.getItem('access') || 'anonymous');
api.interceptors.request.use((config) => {
  if (!['get', 'head', 'options'].includes(config.method)) {
    clearPendingReads();
    clearCachedReads();
  }
  config._activityId = beginRequest();
  return config;
});
// Settle every request, including failures and cancellations, before auth retries.
api.interceptors.response.use((response) => {
  endRequest(response.config._activityId);
  return response;
}, (error) => {
  endRequest(error.config?._activityId);
  return Promise.reject(error);
});

const isAuthEndpoint = (url = '') => (
  url.includes('/token/') ||
  url.includes('/token/refresh/') ||
  url.includes('/register/')
);

// Request interceptor to add token to headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access');
    if (token && !isAuthEndpoint(config.url)) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't already retried
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint(originalRequest.url)
    ) {
      originalRequest._retry = true;

      try {
        const refresh = localStorage.getItem('refresh');
        if (refresh) {
          const activity = beginRequest();
          let response;
          try {
            response = await axios.post('/api/token/refresh/', { refresh });
          } finally {
            endRequest(activity);
          }

          // Update the access token
          localStorage.setItem('access', response.data.access);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${response.data.access}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        localStorage.removeItem('role');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
