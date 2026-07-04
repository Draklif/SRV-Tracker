'use strict';

const { ZodError } = require('zod');
const logger = require('../utils/logger');
const config = require('../config');
const { toFieldErrors } = require('../utils/validation');

/**
 * Manejador de errores central. Debe registrarse el último, después de las rutas.
 * Traduce errores de validación (Zod o de dominio con `fields`) y errores de
 * negocio a JSON (API) o a la página de error (web). Los inesperados se ocultan
 * al usuario pero se registran completos.
 */
// eslint-disable-next-line no-unused-vars -- Express detecta el manejador por su aridad (4 args).
module.exports = function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let fields = err.fields || null;

  if (err instanceof ZodError) {
    status = 422;
    fields = toFieldErrors(err);
  }

  if (status >= 500) {
    logger.error(err.stack || err.message);
  }

  const message =
    err instanceof ZodError
      ? 'Revisa los datos e inténtalo de nuevo.'
      : err.expose || status < 500
        ? err.message
        : 'Algo salió mal de nuestro lado. Inténtalo de nuevo en un momento.';

  if (req.path.startsWith('/api')) {
    return res.status(status).json({ error: message, fields, details: err.details });
  }

  return res.status(status).render('pages/error', {
    title: 'Ups',
    status,
    message,
    stack: config.isProd ? null : err.stack,
  });
};
