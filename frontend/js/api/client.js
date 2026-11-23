// The only place that calls the backend (fetch). Logged-in requests carry the bearer token. Errors become an
// ApiError with the backend's message and field details. A 401 on a logged-in request ends the session (the
// handler is set in app.js). Nothing is ever retried automatically, and passwords and tokens are never logged.
import { API_BASE_URL } from '../config.js';
import { getToken } from '../auth/auth.js';

// Messages used when the backend did not send its own.
const DEFAULT_MESSAGES = {
  0: 'Could not reach the PoultryStart server. Check your internet connection and try again.',
  400: 'Some of the information provided is invalid.',
  401: 'Please log in to continue.',
  403: 'Your role on this farm does not allow this.',
  404: 'This was not found, or you do not have access to it.',
  409: 'This conflicts with information that has already been saved.',
  413: 'The information sent is too large.',
  500: 'Something went wrong on the server. Please try again.',
};

export class ApiError extends Error {
  constructor(status, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // 0 = the server could not be reached
    this.details = Array.isArray(details) ? details : [];
  }
}

export function defaultMessage(status) {
  return DEFAULT_MESSAGES[status] || (status >= 500 ? DEFAULT_MESSAGES[500] : 'The request could not be completed.');
}

let unauthorizedHandler = null;

// app.js registers what happens when a logged-in request gets 401.
export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

export async function request(method, path, { body, auth = true, handleUnauthorized = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = getToken();
    if (!token) {
      const error = new ApiError(401, defaultMessage(401));
      if (handleUnauthorized && unauthorizedHandler) unauthorizedHandler(error);
      throw error;
    }
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, defaultMessage(0));
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null; // not JSON (e.g. a proxy error page)
  }

  if (response.ok) {
    return { data: payload?.data, message: payload?.message || null };
  }

  const error = new ApiError(
    response.status,
    payload?.error?.message || defaultMessage(response.status),
    payload?.error?.details,
  );
  if (response.status === 401 && auth && handleUnauthorized && unauthorizedHandler) unauthorizedHandler(error);
  throw error;
}

export const get = (path, options) => request('GET', path, options);
export const post = (path, body, options = {}) => request('POST', path, { ...options, body });
export const patch = (path, body, options = {}) => request('PATCH', path, { ...options, body });
export const del = (path, options) => request('DELETE', path, options);
