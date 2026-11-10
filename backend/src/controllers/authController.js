// Handles HTTP requests for /api/auth. Controllers stay thin: they read
// the validated input, call a service, and send the response.
const authService = require('../services/authService');
const { sendSuccess } = require('../utils/response');

async function register(req, res) {
  const { user, token } = await authService.register(req.validated);
  sendSuccess(res, 201, { user, token }, 'Account created successfully.');
}

async function login(req, res) {
  const { user, token } = await authService.login(req.validated);
  sendSuccess(res, 200, { user, token }, 'Logged in successfully.');
}

// Handles HTTP requests for /api/auth/logout.
function logout(req, res) {
  sendSuccess(res, 200, undefined, 'Logged out. Please remove the token from the client.');
}

function me(req, res) {
  sendSuccess(res, 200, { user: req.user });
}

module.exports = { register, login, logout, me };
