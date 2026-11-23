// Farm member endpoints. View: owner and manager. Add, change role, remove: owner only.
import { get, post, patch, del } from './client.js';

const base = (farmId) => `/farms/${encodeURIComponent(farmId)}/members`;

// Owner first, then managers, then workers.
export function listMembers(farmId) {
  return get(base(farmId));
}

// The email must belong to a registered account (otherwise 404); an existing member is 409.
export function addMember(farmId, details) {
  return post(base(farmId), details);
}

// The owner's role cannot change (400).
export function changeMemberRole(farmId, memberId, role) {
  return patch(`${base(farmId)}/${encodeURIComponent(memberId)}`, { role });
}

// The owner cannot be removed (400). The member's open tasks become unassigned.
export function removeMember(farmId, memberId) {
  return del(`${base(farmId)}/${encodeURIComponent(memberId)}`);
}
