'use strict';

const { ROLES } = require('../config/constants');
const notFound = require('./notFound');

/**
 * Exige rol de administrador. Va SIEMPRE después de requireAuth (asume req.user).
 *
 * Para /api responde 403 JSON. Para páginas NO redirige ni avisa: responde un 404
 * idéntico al de una ruta inexistente, para que el panel de admin no sea siquiera
 * descubrible por un usuario normal (un 403 con mensaje ya delataría que existe).
 */
module.exports = function requireAdmin(req, res, next) {
  if (req.user && req.user.role === ROLES.ADMIN) return next();

  if (req.path.startsWith('/api')) {
    return res.status(403).json({ error: 'No autorizado.' });
  }

  return notFound(req, res);
};
