// Entry point: prepares the database and starts the HTTP server.
const config = require('./config/env');
const { getDb, closeDb } = require('./config/database');
const app = require('./app');
const { seedDemoData } = require('./demo/demoSeed');

getDb(); // opens the database and creates any missing tables

const server = app.listen(config.port, () => {
  console.log(`PoultryStart API listening on http://localhost:${config.port}/api (${config.env})`);
  if (config.demoSeed) {
    seedDemoData(`http://127.0.0.1:${server.address().port}/api`, { password: config.demoPassword })
      .catch((err) => console.error(`Demo seed failed: ${err.message}`));
  }
});

// Close the database cleanly when the server is stopped 
function shutdown() {
  server.close(() => {
    closeDb();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
