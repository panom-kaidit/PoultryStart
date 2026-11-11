// Database operations for the "users" table.
const { getDb } = require('../config/database');

// Converts a database row into the object the API returns.
function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
  };
}

function create({ name, email, passwordHash }) {
  const result = getDb()
    .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(name, email, passwordHash);
  return findById(result.lastInsertRowid);
}

function findById(id) {
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
  return toPublicUser(row);
}

// Returns the full row INCLUDING password_hash.
function findByEmailWithPassword(email) {
  return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) || null;
}

function findByEmail(email) {
  const row = getDb().prepare('SELECT * FROM users WHERE email = ?').get(email);
  return toPublicUser(row);
}

function emailExists(email) {
  return Boolean(getDb().prepare('SELECT 1 FROM users WHERE email = ?').get(email));
}

module.exports = { create, findById, findByEmail, findByEmailWithPassword, emailExists };
