'use strict';

const db = require('./connection');

/**
 * Ejecuta `fn` dentro de una transacción y devuelve su resultado.
 * Permite a los services orquestar varias operaciones de repositorio de forma
 * atómica sin importar directamente la conexión SQL.
 */
module.exports = function withTransaction(fn) {
  return db.transaction(fn)();
};
