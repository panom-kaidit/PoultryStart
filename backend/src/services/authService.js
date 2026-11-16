
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const userModel = require('../models/userModel');
const AppError = require('../utils/AppError');

const DUMMY_HASH = bcrypt.hashSync('poultrystart-dummy-password', config.bcryptRounds);

function createToken(user) {
  return jwt.sign({ sub: String(user.id) }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

async function register({ name, email, password }) {
  if (userModel.emailExists(email)) {
    throw new AppError(409, 'An account with this email already exists.');
  }
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  const user = userModel.create({ name, email, passwordHash });
  return { user, token: createToken(user) };
}

async function login({ email, password }) {
  const row = userModel.findByEmailWithPassword(email);
  const passwordMatches = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);

  
  if (!row || !passwordMatches) {
    throw new AppError(401, 'Invalid email or password.');
  }

  const user = userModel.findById(row.id); 
  return { user, token: createToken(user) };
}

function verifyToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Your session has expired. Please log in again.'
        : 'Invalid authentication token.';
    throw new AppError(401, message);
  }

  const user = userModel.findById(Number(payload.sub));
  if (!user) {
    throw new AppError(401, 'The account for this token no longer exists.');
  }
  return user;
}

module.exports = { register, login, verifyToken };
