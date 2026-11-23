// A hash router: the page depends on the address after "#", which works with any static file server.

// "#/farms/3/home?reason=x" -> { path: '/farms/3/home', query: { reason: 'x' } }
export function parseHash(hash) {
  const raw = String(hash || '').replace(/^#/, '') || '/';
  const [pathPart, queryPart = ''] = raw.split('?');
  const path = `/${pathPart.split('/').filter(Boolean).join('/')}`;
  const query = Object.fromEntries(new URLSearchParams(queryPart));
  return { path, query };
}

// Finds the first route whose pattern matches the path. A ":name" part
// matches one segment and is returned in params.
export function matchRoute(routes, path) {
  const parts = path.split('/').filter(Boolean);
  for (const route of routes) {
    const pattern = route.path.split('/').filter(Boolean);
    if (pattern.length !== parts.length) continue;
    const params = {};
    let matched = true;
    for (let i = 0; i < pattern.length; i += 1) {
      if (pattern[i].startsWith(':')) {
        params[pattern[i].slice(1)] = decodeURIComponent(parts[i]);
      } else if (pattern[i] !== parts[i]) {
        matched = false;
        break;
      }
    }
    if (matched) return { route, params };
  }
  return null;
}

export function currentHash() {
  return window.location.hash || '#/';
}

// Goes to an app address such as "/farms". replace: true changes the
// address without adding a Back-button step.
export function navigate(path, { replace = false } = {}) {
  const hash = `#${path}`;
  if (replace) window.location.replace(hash);
  else window.location.hash = hash;
}

export function startRouter(render) {
  window.addEventListener('hashchange', render);
  render();
}
