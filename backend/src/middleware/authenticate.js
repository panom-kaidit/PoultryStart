// Authenticates requests using a Bearer token.
const authService = require('../services/authService');
const AppError = require('../utils/AppError');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'Authentication required. Please log in.');
  }

  req.user = authService.verifyToken(token);
  next();
}

module.exports = authenticate;
