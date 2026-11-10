// the user's membership on it.
const farmModel = require('../models/farmModel');
const membershipModel = require('../models/membershipModel');
const AppError = require('../utils/AppError');
const { roleHasPermission } = require('../utils/permissions');
const { parseId } = require('../utils/ids');

// Step 1: loads the farm and the user's membership on it.
function loadFarmAccess(req, res, next) {
  const farmId = parseId(req.params.farmId, 'Farm ID');
  const farm = farmModel.findById(farmId);
  const membership = farm ? membershipModel.findByFarmAndUser(farmId, req.user.id) : null;
  if (!farm || !membership) {
    throw new AppError(404, 'Farm not found.');
  }

  req.farm = farm;
  req.membership = membership; // e.g. { role: 'manager', ... }
  next();
}

// Step 2: checks the user's role against the permission matrix
function requirePermission(permission) {
  return function checkPermission(req, res, next) {
    if (!roleHasPermission(req.membership.role, permission)) {
      throw new AppError(403, 'Your role on this farm does not allow this action.');
    }
    next();
  };
}

module.exports = { loadFarmAccess, requirePermission };
