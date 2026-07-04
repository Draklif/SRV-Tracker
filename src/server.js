'use strict';

const createApp = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { runMigrations } = require('./database/migrate');

/**
 * Punto de entrada. Aplica migraciones pendientes y levanta el servidor HTTP.
 */
function start() {
  runMigrations();
  // Catálogo de logros: idempotente, garantiza que exista tras cada deploy.
  require('./database/seeds/achievements').seedAchievements();

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(`Tracker escuchando en http://localhost:${config.port} (${config.env})`);
  });

  // Apagado ordenado.
  const shutdown = (signal) => {
    logger.info(`Recibido ${signal}, cerrando servidor…`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
