// The login session.
const TOKEN_KEY = 'poultrystart.token';
const RETURN_KEY = 'poultrystart.returnTo';

let currentUser = null;
const endListeners = [];

function storage() {
  try {
    return globalThis.sessionStorage || null;
  } catch {
    return null; // storage blocked by the browser
  }
}

export function getToken() {
  try {
    return storage()?.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  return Boolean(getToken());
}

export function startSession(token, user) {
  storage()?.setItem(TOKEN_KEY, token);
  currentUser = user || null;
}

export function getUser() {
  return currentUser;
}

export function setUser(user) {
  currentUser = user;
}

// The current farm and unsaved form input register here to be cleared when the session ends.
export function onSessionEnd(listener) {
  endListeners.push(listener);
}

// Ends the session: removes the token and everything in memory about the user and their farm. keepReturnTo
// keeps the page the user was on (when the session expired).
export function endSession({ keepReturnTo = false } = {}) {
  const store = storage();
  store?.removeItem(TOKEN_KEY);
  if (!keepReturnTo) store?.removeItem(RETURN_KEY);
  currentUser = null;
  for (const listener of endListeners) listener();
}

// The page to go back to after logging in (a "#/..." address of this app only).
const isReturnable = (hash) => typeof hash === 'string' && hash.startsWith('#/')
  && !hash.startsWith('#/login') && !hash.startsWith('#/register');

export function setReturnTo(hash) {
  if (isReturnable(hash)) storage()?.setItem(RETURN_KEY, hash);
}

export function takeReturnTo() {
  const store = storage();
  const hash = store?.getItem(RETURN_KEY) || null;
  store?.removeItem(RETURN_KEY);
  return isReturnable(hash) ? hash : null;
}
