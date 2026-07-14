'use strict';

const db = require('../database/connection');

/**
 * Ledger de monedas (append-only, nunca negativo). El índice único
 * (usuario, motivo, fuente, día) es el MISMO que el de xp_events, y eso es lo
 * que hace la acuñación idempotente: repetir una acción el mismo día no da
 * monedas de más.
 *
 * Las dos consultas de reconciliación son el corazón del sistema: preguntan
 * "qué premios de XP de este usuario todavía no tienen su moneda". Como el
 * subscriber en vivo y el backfill hacen la misma pregunta (una acotada al día,
 * la otra no), acuñan exactamente las mismas filas y no pueden pisarse.
 */

// Filas de xp_events que aún no tienen su gemela en coin_events.
//
// Se saltan las filas sin día ni fuente: `day` nació nullable (0002_xp_day) y en
// SQLite dos NULL son DISTINTOS dentro de un índice único, así que una fila así
// se duplicaría en cada pasada del backfill. Cuestan unas pocas monedas de la
// prehistoria; a cambio, el ledger no puede duplicarse jamás.
const PENDING = `
  SELECT x.reason, x.amount, x.source_type, x.source_id, x.day
  FROM xp_events x
  WHERE x.user_id = @user_id
    AND x.day IS NOT NULL
    AND x.source_type IS NOT NULL
    AND x.source_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM coin_events c
      WHERE c.user_id = x.user_id
        AND c.reason = x.reason
        AND c.source_type = x.source_type
        AND c.source_id = x.source_id
        AND c.day = x.day
    )
`;

const statements = {
  insertIfNew: db.prepare(`
    INSERT OR IGNORE INTO coin_events (user_id, amount, reason, source_type, source_id, day)
    VALUES (@user_id, @amount, @reason, @source_type, @source_id, @day)
  `),
  // Lo que falta por acuñar de UN día (el subscriber, tras registrar un hábito).
  pendingForDay: db.prepare(`${PENDING} AND x.day = @day`),
  // Lo que falta por acuñar de SIEMPRE (el backfill), en orden cronológico.
  pendingAll: db.prepare(`${PENDING} ORDER BY x.day, x.id`),
  totalByUser: db.prepare('SELECT COALESCE(SUM(amount), 0) AS n FROM coin_events WHERE user_id = ?'),
  usersWithXp: db.prepare('SELECT DISTINCT user_id FROM xp_events ORDER BY user_id'),
  countSkippable: db.prepare(
    'SELECT COUNT(*) AS n FROM xp_events WHERE day IS NULL OR source_type IS NULL OR source_id IS NULL'
  ),
};

/** Acuña el premio si no existía. Devuelve true si se otorgó. */
function insertIfNew(event) {
  return statements.insertIfNew.run(event).changes > 0;
}

function pendingForDay(userId, day) {
  return statements.pendingForDay.all({ user_id: userId, day });
}

function pendingAll(userId) {
  return statements.pendingAll.all({ user_id: userId });
}

/** Total ganado por el usuario en toda su historia (auditoría del saldo). */
function totalByUser(userId) {
  return statements.totalByUser.get(userId).n;
}

/** Usuarios con algún premio de XP: los únicos a los que el backfill debe mirar. */
function usersWithXp() {
  return statements.usersWithXp.all().map((r) => r.user_id);
}

/** Filas de xp_events que el backfill saltará por no tener día o fuente. */
function countSkippable() {
  return statements.countSkippable.get().n;
}

module.exports = {
  insertIfNew,
  pendingForDay,
  pendingAll,
  totalByUser,
  usersWithXp,
  countSkippable,
};
