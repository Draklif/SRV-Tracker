'use strict';

const db = require('../database/connection');

/** Acceso a datos de reacciones (solo emojis, sin comentarios). */

const statements = {
  insert: db.prepare(`
    INSERT OR IGNORE INTO reactions (activity_event_id, user_id, emoji)
    VALUES (@event_id, @user_id, @emoji)
  `),
  remove: db.prepare(`
    DELETE FROM reactions WHERE activity_event_id = @event_id AND user_id = @user_id AND emoji = @emoji
  `),
  countsForEvent: db.prepare(`
    SELECT emoji, COUNT(*) AS n FROM reactions WHERE activity_event_id = ? GROUP BY emoji
  `),
  forEvents: db.prepare(`
    SELECT activity_event_id, emoji, COUNT(*) AS n,
           MAX(CASE WHEN user_id = @user_id THEN 1 ELSE 0 END) AS mine
    FROM reactions
    WHERE activity_event_id IN (SELECT value FROM json_each(@ids))
    GROUP BY activity_event_id, emoji
  `),
};

/** Alterna una reacción. Devuelve true si quedó puesta, false si se quitó. */
function toggle(eventId, userId, emoji) {
  const inserted = statements.insert.run({ event_id: eventId, user_id: userId, emoji }).changes > 0;
  if (!inserted) statements.remove.run({ event_id: eventId, user_id: userId, emoji });
  return inserted;
}

function countsForEvent(eventId) {
  return statements.countsForEvent.all(eventId);
}

/** Conteos por emoji (con marca "mía") para un conjunto de eventos. */
function forEvents(eventIds, userId) {
  return statements.forEvents.all({ ids: JSON.stringify(eventIds), user_id: userId });
}

module.exports = { toggle, countsForEvent, forEvents };
