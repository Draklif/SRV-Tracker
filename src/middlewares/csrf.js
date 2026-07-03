'use strict';

const crypto = require('crypto');
const { ForbiddenError } = require('../utils/errors');

/**
 * Protección CSRF con patrón "synchronizer token": un token aleatorio por
 * sesión que debe reenviarse en cada mutación (campo _csrf o header
 * X-CSRF-Token). Cero dependencias extra; encaja con formularios y fetch.
 */

function ensureToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

/** Expone el token a las vistas (para incrustarlo en formularios y <meta>). */
function csrfToken(req, res, next) {
  res.locals.csrfToken = ensureToken(req);
  next();
}

/** Verifica el token en peticiones que modifican estado. */
function verifyCsrf(req, res, next) {
  const expected = req.session && req.session.csrfToken;
  const sent = (req.body && req.body._csrf) || req.get('x-csrf-token');

  if (!expected || !sent || !timingSafeEqual(sent, expected)) {
    return next(new ForbiddenError('Sesión expirada o token inválido. Recarga la página.'));
  }
  next();
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = { csrfToken, verifyCsrf };
