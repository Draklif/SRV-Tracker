'use strict';

/**
 * Envuelve un handler async para que cualquier promesa rechazada se propague
 * al middleware de errores de Express en lugar de quedar sin capturar.
 *
 *   router.get('/', asyncHandler(async (req, res) => { ... }));
 */
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
