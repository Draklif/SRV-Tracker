'use strict';

const config = require('./config');
const logger = require('./utils/logger');
const { runMigrations } = require('./database/migrate');

// Debe correr antes de `require('./app')`: los repositorios preparan sus
// statements SQL al cargarse, así que las tablas ya deben existir.
runMigrations();
require('./database/seeds/achievements').seedAchievements();

const createApp = require('./app');

/**
 * Punto de entrada. Levanta el servidor HTTP una vez migrada la base de datos.
 */
function start() {
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
