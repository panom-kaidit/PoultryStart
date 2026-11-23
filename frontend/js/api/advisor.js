// GET /farms/:farmId/advisor?flockId=: every farm role (the backend leaves out what a role may not see).
// Read-only: it changes nothing and generates no tasks.
import { get } from './client.js';
import { queryString } from './production.js';

export function getAdvice(farmId, { flockId } = {}) {
  return get(`/farms/${encodeURIComponent(farmId)}/advisor${queryString({ flockId })}`);
}
