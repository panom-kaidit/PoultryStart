// Handles HTTP requests for /api/farms/:farmId/members.
const memberService = require('../services/memberService');
const { sendSuccess } = require('../utils/response');
const { parseId } = require('../utils/ids');

function listMembers(req, res) {
  const members = memberService.listMembers(req.farm.id);
  sendSuccess(res, 200, { members });
}

function addMember(req, res) {
  const member = memberService.addMember(req.farm.id, req.user.id, req.validated);
  sendSuccess(res, 201, { member }, `${member.name} was added as a farm ${member.role}.`);
}

function changeRole(req, res) {
  const memberId = parseId(req.params.memberId, 'Member ID');
  const member = memberService.changeRole(req.farm.id, memberId, req.validated.role);
  sendSuccess(res, 200, { member }, `${member.name} is now a farm ${member.role}.`);
}

function removeMember(req, res) {
  const memberId = parseId(req.params.memberId, 'Member ID');
  const member = memberService.removeMember(req.farm.id, memberId);
  sendSuccess(res, 200, undefined, `${member.name} was removed from the farm.`);
}

module.exports = { listMembers, addMember, changeRole, removeMember };
