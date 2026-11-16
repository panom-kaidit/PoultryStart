// Creates the database file and all tables, then lists them.
// Run with:  npm run db:init
const { getDb, closeDb } = require('../src/config/database');
const config = require('../src/config/env');

const db = getDb();
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all();

console.log(`Database ready at ${config.dbPath}`);
for (const { name } of tables) {
  const columns = db.prepare(`PRAGMA table_info(${name})`).all().map((c) => c.name);
  console.log(`  ${name.padEnd(26)} ${columns.join(', ')}`);
}
closeDb();
