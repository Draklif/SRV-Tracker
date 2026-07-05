'use strict';

const db = require('../database/connection');

/**
 * Acceso a datos del feed de actividad. El feed está acotado a un conjunto de
 * autores (@ids, JSON de user_id = amigos + uno mismo); el service lo calcula.
 * Se ligan como JSON + json_each porque better-sqlite3 no liga arrays.
 */

const statements = {
  insert: db.prepare(
    'INSERT INTO activity_events (user_id, type, payload) VALUES (@user_id, @type, @payload)'
  ),
  byId: db.prepare(`
    SELECT ae.*, u.username, u.display_name, u.avatar_path
    FROM activity_events ae JOIN users u ON u.id = ae.user_id
    WHERE ae.id = ?
  `),
  feed: db.prepare(`
    SELECT ae.*, u.username, u.display_name, u.avatar_path
    FROM activity_events ae JOIN users u ON u.id = ae.user_id
    WHERE ae.user_id IN (SELECT value FROM json_each(@ids))
    ORDER BY ae.id DESC LIMIT @limit
  `),
  after: db.prepare(`
    SELECT ae.*, u.username, u.display_name, u.avatar_path
    FROM activity_events ae JOIN users u ON u.id = ae.user_id
    WHERE ae.id > @after AND ae.user_id IN (SELECT value FROM json_each(@ids))
    ORDER BY ae.id ASC LIMIT 20
  `),
  // Anti-spam: ¿ya existe hoy un evento igual (mismo usuario/tipo/hábito)?
  existsForDay: db.prepare(`
    SELECT 1 FROM activity_events
    WHERE user_id = @user_id AND type = @type
      AND json_extract(payload, '$.habitId') = @habit_id
      AND json_extract(payload, '$.day') = @day
    LIMIT 1
  `),
};

function insert(userId, type, payload) {
  const info = statements.insert.run({ user_id: userId, type, payload: JSON.stringify(payload) });
  return statements.byId.get(info.lastInsertRowid);
}

/** Feed de los autores `idsJson` (JSON de user_id), más recientes primero. */
function feed(idsJson, limit) {
  return statements.feed.all({ ids: idsJson, limit });
}

/** Eventos posteriores a `afterId` de los autores `idsJson` (para SSE). */
function after(idsJson, afterId) {
  return statements.after.all({ ids: idsJson, after: afterId });
}

function existsForDay(userId, type, habitId, day) {
  return Boolean(statements.existsForDay.get({ user_id: userId, type, habit_id: habitId, day }));
}

module.exports = { insert, feed, after, existsForDay };
