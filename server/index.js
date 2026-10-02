const fs = require('node:fs');
const path = require('node:path');

const envPath = path.join(__dirname, '.env');
if (process.loadEnvFile && fs.existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath);
  } catch {
    console.error('Unable to load server environment configuration.');
  }
}

const { createPool, initializeDatabase } = require('./database');
const { createApp } = require('./app');

async function startServer() {
  let pool;
  try {
    pool = createPool();
    await initializeDatabase(pool);
    const app = createApp(pool);
    const port = process.env.PORT || 5000;
    const server = app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });

    const shutdown = () => {
      server.close(() => {
        pool.end().then(() => process.exit(0));
      });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch {
    if (pool) {
      await pool.end().catch(() => {});
    }
    console.error('Campus Eats API could not start. Check database configuration and connectivity.');
    process.exitCode = 1;
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };