// Backend endpoints for accounts and login (/api/auth).
import { get, post } from './client.js';

// { name, email, password } -> { user, token }
export function register(details) {
  return post('/auth/register', details, { auth: false });
}

// A wrong password is a 401 that must not be treated as "session expired", hence auth: false.
export function login(credentials) {
  return post('/auth/login', credentials, { auth: false });
}

// The backend does not revoke tokens; the app removes the token itself. A 401 here is ignored.
export function logout() {
  return post('/auth/logout', undefined, { handleUnauthorized: false });
}

export function me() {
  return get('/auth/me');
}
