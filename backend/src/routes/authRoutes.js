// Routes for /api/auth (FR-01)
const express = require('express');
const authController = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { registerRules, loginRules } = require('../validators/authValidators');

const router = express.Router();

router.post('/register', registerRules, validate, authController.register);
router.post('/login', loginRules, validate, authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

module.exports = router;
