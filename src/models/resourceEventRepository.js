'use strict';

const db = require('../database/connection');

/**
 * Ledger de recursos (append-only). El índice único (user, resource, reason,
 * source, day) hace la inserción idempotente: repetir una acción el mismo día
 * no duplica recursos. Único lugar con SQL de la tabla `resource_events`.
 */

const statements = {
  insertIfNew: db.prepare(`
    INSERT OR IGNORE INTO resource_events (user_id, resource_type, amount, reason, source_type, source_id, day)
    VALUES (@user_id, @resource_type, @amount, @reason, @source_type, @source_id, @day)
  `),
  totalsByUser: db.prepare(`
    SELECT resource_type, SUM(amount) AS total
    FROM resource_events WHERE user_id = ? GROUP BY resource_type
  `),
  globalTotals: db.prepare(`
    SELECT resource_type, SUM(amount) AS total
    FROM resource_events GROUP BY resource_type
  `),
};

/** Inserta el premio si no existía. Devuelve true si se otorgó. */
function insertIfNew(event) {
  return statements.insertIfNew.run(event).changes > 0;
}

/** Totales del usuario: [{ resource_type, total }]. */
function totalsByUser(userId) {
  return statements.totalsByUser.all(userId);
}

/** Pool global (para la aldea futura): [{ resource_type, total }]. */
function globalTotals() {
  return statements.globalTotals.all();
}

module.exports = { insertIfNew, totalsByUser, globalTotals };
