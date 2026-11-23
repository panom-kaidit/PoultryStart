import { me } from '../api/auth.js';
import { getUser, isLoggedIn, setReturnTo, setUser } from './auth.js';
import { canOpen } from '../farm/access.js';

export function requireLogin(hash, navigate) {
  if (isLoggedIn()) return true;
  setReturnTo(hash);
  navigate('/login', { replace: true });
  return false;
}

export async function ensureUser() {
  const known = getUser();
  if (known) return known;
  const { data } = await me();
  setUser(data.user);
  return data.user;
}

export function roleMayOpen(role, feature) {
  return canOpen(role, feature);
}
