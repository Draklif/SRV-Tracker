'use strict';

/**
 * Solo para invitados: si ya hay sesión, redirige al inicio.
 * Evita mostrar login/registro a quien ya entró.
 */
module.exports = function requireGuest(req, res, next) {
  if (req.user) return res.redirect('/');
  next();
};
