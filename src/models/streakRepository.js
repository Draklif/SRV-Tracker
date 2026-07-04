'use strict';

const db = require('../database/connection');

/**
 * Cache de rachas por hábito (`habit_streaks`). Siempre recomputable desde
 * `habit_logs`; se guarda para lecturas rápidas del dashboard.
 */

const statements = {
  get: db.prepare('SELECT * FROM habit_streaks WHERE habit_id = ?'),
  byUser: db.prepare(`
    SELECT hs.* FROM habit_streaks hs
    JOIN habits h ON h.id = hs.habit_id
    WHERE h.user_id = ?
  `),
  topByUser: db.prepare(`
    SELECT h.name, h.icon, h.color, hs.current_streak, hs.longest_streak
    FROM habit_streaks hs
    JOIN habits h ON h.id = hs.habit_id
    WHERE h.user_id = ? AND h.is_archived = 0 AND hs.current_streak > 0
    ORDER BY hs.current_streak DESC
    LIMIT ?
  `),
  upsert: db.prepare(`
    INSERT INTO habit_streaks (habit_id, current_streak, longest_streak, last_completed_date)
    VALUES (@habit_id, @current_streak, @longest_streak, @last_completed_date)
    ON CONFLICT(habit_id) DO UPDATE SET
      current_streak = excluded.current_streak,
      longest_streak = excluded.longest_streak,
      last_completed_date = excluded.last_completed_date
  `),
};

function get(habitId) {
  return statements.get.get(habitId);
}

function findByUser(userId) {
  return statements.byUser.all(userId);
}

function upsert(row) {
  statements.upsert.run(row);
  return statements.get.get(row.habit_id);
}

/** Mejores rachas activas de un usuario (para su perfil público). */
function topByUser(userId, limit = 3) {
  return statements.topByUser.all(userId, limit);
}

module.exports = { get, findByUser, upsert, topByUser };
