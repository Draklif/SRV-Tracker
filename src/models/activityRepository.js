'use strict';

const db = require('../database/connection');

/** Acceso a datos del feed de actividad global. */

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
    ORDER BY ae.id DESC LIMIT ?
  `),
  after: db.prepare(`
    SELECT ae.*, u.username, u.display_name, u.avatar_path
    FROM activity_events ae JOIN users u ON u.id = ae.user_id
    WHERE ae.id > ? ORDER BY ae.id ASC LIMIT 20
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

function feed(limit) {
  return statements.feed.all(limit);
}

function after(id) {
  return statements.after.all(id);
}

function existsForDay(userId, type, habitId, day) {
  return Boolean(statements.existsForDay.get({ user_id: userId, type, habit_id: habitId, day }));
}

module.exports = { insert, feed, after, existsForDay };
