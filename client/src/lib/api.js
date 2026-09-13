// Thin fetch wrapper around the API. Handles base URL, auth header, JSON
// parsing and turning error responses into thrown Error objects.

export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function apiUrl(path) {
  return `${API_BASE}/api${path}`;
}

// For URLs the API already returns with a leading /api (e.g. public photo URLs).
export function absoluteUrl(pathStartingWithApi) {
  return `${API_BASE}${pathStartingWithApi}`;
}

let authToken = localStorage.getItem('token') || null;

export function setToken(token) {
  authToken = token;
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

export function getToken() {
  return authToken;
}

async function parse(res) {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = data?.error?.message || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.details = data?.error?.details;
    throw err;
  }
  return data;
}

function request(method, path, body, { auth = true, isForm = false } = {}) {
  const headers = {};
  if (auth && authToken) headers.Authorization = `Bearer ${authToken}`;
  let payload;
  if (isForm) {
    payload = body; // FormData
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  return fetch(apiUrl(path), { method, headers, body: payload }).then(parse);
}

export const api = {
  get: (p, opts) => request('GET', p, undefined, opts),
  post: (p, body, opts) => request('POST', p, body, opts),
  put: (p, body, opts) => request('PUT', p, body, opts),
  patch: (p, body, opts) => request('PATCH', p, body, opts),
  del: (p, opts) => request('DELETE', p, undefined, opts),
  postForm: (p, formData, opts) => request('POST', p, formData, { ...opts, isForm: true }),
};

// Build an <img src> for a protected photo. The raw endpoints need the bearer
// token, which <img> can't send, so for authenticated views we fetch as a blob.
export async function fetchImageObjectUrl(path) {
  const headers = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(apiUrl(path), { headers });
  if (!res.ok) throw new Error('Failed to load image');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
