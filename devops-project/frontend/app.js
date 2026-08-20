// Base URL for the backend API.
// In Docker, nginx proxies /api/* to the backend service (see nginx.conf),
// so we can just use relative paths here - no hardcoded host/port needed.
const API_BASE = '';

function apiFetch(path, options = {}) {
  return fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
}

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
