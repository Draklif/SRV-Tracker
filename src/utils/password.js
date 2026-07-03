'use strict';

const bcrypt = require('bcryptjs');

// Coste del hash. 12 es un buen equilibrio seguridad/latencia en 2025+.
const SALT_ROUNDS = 12;

/** Genera el hash de una contraseña en claro. */
function hash(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** Compara una contraseña en claro contra su hash. */
function compare(plain, hashed) {
  return bcrypt.compare(plain, hashed);
}

/**
 * Hash válido de referencia, calculado una vez al arrancar. Sirve para igualar
 * el tiempo de `compare` cuando el usuario no existe (evita enumeración por
 * temporización) sin arriesgar un hash malformado.
 */
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy-password', SALT_ROUNDS);

module.exports = { hash, compare, DUMMY_HASH };
