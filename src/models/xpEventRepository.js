'use strict';

const db = require('../database/connection');

/**
 * Ledger de XP (append-only). El índice único (user, reason, source, day)
 * hace la inserción idempotente: repetir una acción el mismo día no duplica XP.
 */

const statements = {
  insertIfNew: db.prepare(`
    INSERT OR IGNORE INTO xp_events (user_id, amount, reason, source_type, source_id, day)
    VALUES (@user_id, @amount, @reason, @source_type, @source_id, @day)
  `),
  countByReason: db.prepare('SELECT COUNT(*) AS n FROM xp_events WHERE user_id = ? AND reason = ?'),
};

/** Inserta el premio si no existía. Devuelve true si se otorgó. */
function insertIfNew(event) {
  return statements.insertIfNew.run(event).changes > 0;
}

function countByReason(userId, reason) {
  return statements.countByReason.get(userId, reason).n;
}

module.exports = { insertIfNew, countByReason };
