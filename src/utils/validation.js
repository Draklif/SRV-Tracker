'use strict';

const { ZodError } = require('zod');

/**
 * Traduce errores de validación a un mapa { campo: 'mensaje' } para re-pintar
 * formularios. Soporta ZodError y errores de dominio con `.fields`.
 * Devuelve null si el error no es de validación (debe propagarse al errorHandler).
 */
function toFieldErrors(err) {
  if (err instanceof ZodError) {
    const { fieldErrors } = err.flatten();
    const fields = {};
    for (const [key, messages] of Object.entries(fieldErrors)) {
      if (messages && messages.length) fields[key] = messages[0];
    }
    return fields;
  }
  if (err && err.fields) return err.fields;
  return null;
}

module.exports = { toFieldErrors };
