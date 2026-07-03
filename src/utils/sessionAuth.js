'use strict';

/**
 * Helpers de sesión (promisificados) para el flujo de autenticación.
 * Regeneramos la sesión al iniciar para prevenir fijación de sesión.
 */

/** Inicia sesión para `userId`: regenera el id de sesión y lo persiste. */
function startSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
    });
  });
}

/** Cierra la sesión por completo. */
function endSession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}

module.exports = { startSession, endSession };
