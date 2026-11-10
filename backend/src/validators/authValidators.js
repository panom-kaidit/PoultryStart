// Input rules for registration and login.
const { body } = require('express-validator');

const emailRule = body('email')
  .isString().withMessage('Email is required.')
  .trim()
  .isEmail().withMessage('Enter a valid email address.')
  .isLength({ max: 254 }).withMessage('Email is too long.')
  .customSanitizer((value) => value.toLowerCase());

const registerRules = [
  body('name')
    .isString().withMessage('Name is required.')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .isLength({ max: 100 }).withMessage('Name must be at most 100 characters.'),
  emailRule,
  body('password')
    .isString().withMessage('Password is required.')
    // bcrypt only uses the first 72 bytes of a password, so we cap the length.
    .isLength({ min: 8, max: 72 }).withMessage('Password must be between 8 and 72 characters.'),
];

const loginRules = [
  emailRule,
  body('password')
    .isString().withMessage('Password is required.')
    .notEmpty().withMessage('Password is required.'),
];

module.exports = { registerRules, loginRules, emailRule };
