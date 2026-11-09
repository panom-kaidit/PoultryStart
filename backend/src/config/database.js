// Opens the SQLite database and creates the tables from database/schema.sql.
//
// Only the files in src/models talk to the database through this module.
// To move to another database later (e.g. PostgreSQL), you would change
// this file and the models; controllers and services stay the same.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./env');

const BACKEND_ROOT = path.join(__dirname, '..', '..');
const SCHEMA_FILE = path.join(BACKEND_ROOT, 'database', 'schema.sql');

let db = null;

function getDb() {
  if (db) return db;

  const inMemory = config.dbPath === ':memory:'; // used by the automated tests
  const filePath = inMemory ? ':memory:' : path.resolve(BACKEND_ROOT, config.dbPath);
  if (!inMemory) fs.mkdirSync(path.dirname(filePath), { recursive: true });

  db = new Database(filePath);
  db.pragma('foreign_keys = ON'); // SQLite only enforces foreign keys when this is on
  if (!inMemory) db.pragma('journal_mode = WAL'); // safer concurrent reads/writes

  db.exec(fs.readFileSync(SCHEMA_FILE, 'utf8'));
  return db;
}

// Runs several database operations as one unit: either all of them are
// saved, or (if any of them throws an error) none are.
function runInTransaction(work) {
  return getDb().transaction(work)();
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, runInTransaction, closeDb };
