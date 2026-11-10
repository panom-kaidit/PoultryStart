// Routes for /api/farms/:farmId/members (FR-03, BR-06)
// Mounted in farmRoutes.js after authenticate and loadFarmAccess, so here
// req.user, req.farm and req.membership are already available.
const express = require('express');
const memberController = require('../controllers/memberController');
const validate = require('../middleware/validate');
const { requirePermission } = require('../middleware/farmAccess');
const { addMemberRules, changeRoleRules } = require('../validators/memberValidators');

// mergeParams lets this router read :farmId from the parent route.
const router = express.Router({ mergeParams: true });

router.get('/', requirePermission('members:view'), memberController.listMembers);

router.post('/',
  requirePermission('members:manage'),
  addMemberRules, validate,
  memberController.addMember);

router.patch('/:memberId',
  requirePermission('members:manage'),
  changeRoleRules, validate,
  memberController.changeRole);

router.delete('/:memberId',
  requirePermission('members:manage'),
  memberController.removeMember);

module.exports = router;
