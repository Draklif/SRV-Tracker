'use strict';

const db = require('../database/connection');

/**
 * Registro de notificaciones enviadas. Sirve de dedupe: como máximo un aviso de
 * cada tipo (`kind`) por día local del usuario. Único lugar con SQL de la tabla
 * `notification_log`.
 */

const statements = {
  exists: db.prepare(
    'SELECT 1 FROM notification_log WHERE user_id = @userId AND kind = @kind AND local_date = @date'
  ),
  insert: db.prepare(
    `INSERT OR IGNORE INTO notification_log (user_id, kind, local_date)
     VALUES (@userId, @kind, @date)`
  ),
};

/** ¿Ya se envió una notificación de este tipo a este usuario hoy (fecha local)? */
function wasSent(userId, kind, date) {
  return Boolean(statements.exists.get({ userId, kind, date }));
}

/** Marca como enviada (idempotente). */
function markSent(userId, kind, date) {
  statements.insert.run({ userId, kind, date });
}

module.exports = { wasSent, markSent };
