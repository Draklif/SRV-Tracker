'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Límites de tasa. Protegen los endpoints sensibles de fuerza bruta sin
 * molestar el uso normal. Se responde con un mensaje amable.
 */

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 30, // intentos por IP y ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Demasiados intentos. Toma un respiro y prueba de nuevo en unos minutos 🌿',
});

module.exports = { authLimiter };
