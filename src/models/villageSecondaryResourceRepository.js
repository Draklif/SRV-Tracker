'use strict';

const db = require('../database/connection');

/**
 * Acceso a datos de los recursos SECUNDARIOS de la colonia (capa de supervivencia
 * producida dentro de la base: O₂, raciones, agua tratada…). Único lugar con SQL
 * de `village_secondary_resources`.
 *
 * SCAFFOLD INERTE en Fase A: las filas existen (una por (colonia, recurso)) pero
 * nada las mueve todavía — el sim vivo (producción/consumo por colonos) es Fase B.
 */

const statements = {
  ensureRow: db.prepare(
    'INSERT OR IGNORE INTO village_secondary_resources (village_id, resource_type, amount, cap) VALUES (@village_id, @resource_type, 0, 0)'
  ),
  balances: db.prepare(
    'SELECT resource_type, amount, cap FROM village_secondary_resources WHERE village_id = ?'
  ),
};

/** Crea (si faltan) las filas en 0 para los secundarios dados. */
function ensureRows(villageId, resourceTypes) {
  for (const rt of resourceTypes) {
    statements.ensureRow.run({ village_id: villageId, resource_type: rt });
  }
}

/** Balances actuales de secundarios: [{ resource_type, amount, cap }]. */
function balances(villageId) {
  return statements.balances.all(villageId);
}

module.exports = { ensureRows, balances };
