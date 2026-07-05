'use strict';

const userService = require('../services/userService');
const friendshipService = require('../services/friendshipService');
const { consumeFlash } = require('../utils/flash');

/**
 * Carga el usuario de la sesión (si existe) y expone valores comunes a todas
 * las vistas: `user`, `theme` y `flash`. Se ejecuta en cada petición.
 */
module.exports = function loadUser(req, res, next) {
  req.user = null;
  res.locals.user = null;
  res.locals.flash = consumeFlash(req);
  res.locals.currentPath = req.path;
  res.locals.pendingFriendCount = 0;

  const userId = req.session && req.session.userId;
  if (userId) {
    const user = userService.getById(userId);
    if (user) {
      req.user = user;
      res.locals.user = user;
      res.locals.theme = user.theme;
      res.locals.pendingFriendCount = friendshipService.incomingCount(user.id);
    } else {
      // Sesión apuntando a un usuario inexistente: la limpiamos.
      req.session.userId = null;
    }
  }

  res.locals.theme = res.locals.theme || 'dark';
  next();
};
