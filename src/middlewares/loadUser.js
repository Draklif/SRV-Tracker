'use strict';

const userService = require('../services/userService');
const friendshipService = require('../services/friendshipService');
const changelogService = require('../services/changelogService');
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
  res.locals.hasUnseenChangelog = false;

  const userId = req.session && req.session.userId;
  if (userId) {
    const user = userService.getById(userId);
    if (user) {
      req.user = user;
      res.locals.user = user;
      res.locals.theme = user.theme;
      res.locals.accent = user.accent;
      res.locals.motion = user.motion;
      res.locals.pendingFriendCount = friendshipService.incomingCount(user.id);
      res.locals.hasUnseenChangelog = changelogService.hasUnseen(user);
    } else {
      // Sesión apuntando a un usuario inexistente: la limpiamos.
      req.session.userId = null;
    }
  }

  res.locals.theme = res.locals.theme || 'dark';
  res.locals.accent = res.locals.accent || 'blue';
  // Invitados (landing, login) ven la app en movimiento: es la primera impresión.
  res.locals.motion = res.locals.motion || 'on';
  next();
};
