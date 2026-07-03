'use strict';

const { addFlash } = require('../utils/flash');

/**
 * Exige sesión iniciada. Para /api responde 401 JSON; para páginas redirige a
 * /login recordando a dónde quería ir el usuario.
 */
module.exports = function requireAuth(req, res, next) {
  if (req.user) return next();

  if (req.path.startsWith('/api')) {
    return res.status(401).json({ error: 'Necesitas iniciar sesión.' });
  }

  addFlash(req, 'info', 'Inicia sesión para continuar.');
  req.session.returnTo = req.originalUrl;
  return res.redirect('/login');
};
