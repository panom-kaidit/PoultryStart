// Business logic for farm users and roles
const { runInTransaction } = require('../config/database');
const membershipModel = require('../models/membershipModel');
const userModel = require('../models/userModel');
const taskModel = require('../models/taskModel');
const AppError = require('../utils/AppError');
const { ROLES } = require('../utils/permissions');

function listMembers(farmId) {
  return membershipModel.findMembersOfFarm(farmId);
}

function addMember(farmId, ownerId, { email, role }) {
  const user = userModel.findByEmail(email);
  if (!user) {
    throw new AppError(
      404,
      'No PoultryStart account uses this email. Ask the person to register first, then add them.'
    );
  }

  if (membershipModel.findByFarmAndUser(farmId, user.id)) {
    throw new AppError(409, 'This user is already a member of this farm.');
  }

  const membership = membershipModel.create({ farmId, userId: user.id, role, addedBy: ownerId });
  return membershipModel.findMember(farmId, membership.id);
}

// Finds a member of this farm, or throws 404.
function getMemberOrFail(farmId, membershipId) {
  const member = membershipModel.findMember(farmId, membershipId);
  if (!member) {
    throw new AppError(404, 'Member not found on this farm.');
  }
  return member;
}

function changeRole(farmId, membershipId, role) {
  const member = getMemberOrFail(farmId, membershipId);
  if (member.role === ROLES.OWNER) {
    throw new AppError(400, "The Farm Owner's role cannot be changed.");
  }
  membershipModel.updateRole(membershipId, role);
  return membershipModel.findMember(farmId, membershipId);
}

function removeMember(farmId, membershipId) {
  const member = getMemberOrFail(farmId, membershipId);
  if (member.role === ROLES.OWNER) {
    throw new AppError(400, 'The Farm Owner cannot be removed from the farm.');
  }

  // Both steps succeed together or not at all.
  runInTransaction(() => {
    membershipModel.remove(membershipId);
    taskModel.unassignPendingTasks(farmId, member.userId);
  });
  return member;
}

module.exports = { listMembers, addMember, changeRole, removeMember };
