'use strict';

const logger = require('../utils/logger');
const config = require('../config');

/**
 * Manejador de errores central. Debe registrarse el último, después de las rutas.
 * Distingue errores de validación/negocio (con `status` y `expose`) de los
 * inesperados, que se ocultan al usuario pero se registran completos.
 */
// eslint-disable-next-line no-unused-vars -- Express detecta el manejador por su aridad (4 args).
module.exports = function errorHandler(err, req, res, next) {
  const status = err.status || 500;

  if (status >= 500) {
    logger.error(err.stack || err.message);
  }

  // Mensaje seguro: solo exponemos el detalle en errores marcados o en desarrollo.
  const message =
    err.expose || status < 500
      ? err.message
      : 'Algo salió mal de nuestro lado. Inténtalo de nuevo en un momento.';

  if (req.path.startsWith('/api')) {
    return res.status(status).json({ error: message, details: err.details });
  }

  return res.status(status).render('pages/error', {
    title: 'Ups',
    status,
    message,
    stack: config.isProd ? null : err.stack,
  });
};
