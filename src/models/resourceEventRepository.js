'use strict';

const db = require('../database/connection');

/**
 * Ledger de dimensiones (append-only). El índice único (user, reason, source,
 * day) hace la inserción idempotente: repetir una acción el mismo día no
 * duplica puntos. Único lugar con SQL de la tabla `resource_events`.
 *
 * LA DIMENSIÓN NO SE GUARDA EN EL EVENTO cuando la fuente es un hábito: se
 * deduce con un JOIN a `habits`. Así, cambiar la dimensión de un hábito recoloca
 * todo su histórico solo, porque no existe una segunda copia que pueda
 * contradecir a la primera. `e.resource_type` queda como respaldo para fuentes
 * que no sean hábitos. El JOIN es seguro porque los hábitos se archivan
 * (is_archived), nunca se borran.
 */

/** Dimensión efectiva de un evento: la del hábito si viene de uno; si no, la suya. */
const DIMENSION = "COALESCE(h.resource_type, e.resource_type)";
const FROM_JOINED = `
  FROM resource_events e
  LEFT JOIN habits h ON h.id = e.source_id AND e.source_type = 'habit'
`;

const statements = {
  insertIfNew: db.prepare(`
    INSERT OR IGNORE INTO resource_events (user_id, resource_type, amount, reason, source_type, source_id, day)
    VALUES (@user_id, @resource_type, @amount, @reason, @source_type, @source_id, @day)
  `),
  totalsByUser: db.prepare(`
    SELECT ${DIMENSION} AS resource_type, SUM(e.amount) AS total
    ${FROM_JOINED}
    WHERE e.user_id = ?
    GROUP BY ${DIMENSION}
  `),
  totalsByUserSince: db.prepare(`
    SELECT ${DIMENSION} AS resource_type, SUM(e.amount) AS total
    ${FROM_JOINED}
    WHERE e.user_id = ? AND e.day >= ?
    GROUP BY ${DIMENSION}
  `),
  firstDay: db.prepare('SELECT MIN(day) AS day FROM resource_events WHERE user_id = ?'),
};

/** Inserta el premio si no existía. Devuelve true si se otorgó. */
function insertIfNew(event) {
  return statements.insertIfNew.run(event).changes > 0;
}

/** Totales de siempre: [{ resource_type, total }]. */
function totalsByUser(userId) {
  return statements.totalsByUser.all(userId);
}

/** Totales desde un día (inclusive), para la ventana rodante del radar. */
function totalsByUserSince(userId, sinceDay) {
  return statements.totalsByUserSince.all(userId, sinceDay);
}

/** Día del primer evento del usuario (o null). Base de su antigüedad. */
function firstDay(userId) {
  return statements.firstDay.get(userId).day;
}

module.exports = { insertIfNew, totalsByUser, totalsByUserSince, firstDay };
