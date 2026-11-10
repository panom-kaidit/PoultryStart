// Input rules for adding members and changing their role (FR-03).
const { body } = require('express-validator');
const { emailRule } = require('./authValidators');

// Roles that can be assigned to members.
const ASSIGNABLE_ROLES = ['manager', 'worker'];

const roleRule = body('role')
  .isIn(ASSIGNABLE_ROLES)
  .withMessage('Role must be "manager" or "worker".');

const addMemberRules = [emailRule, roleRule];
const changeRoleRules = [roleRule];

module.exports = { addMemberRules, changeRoleRules };
