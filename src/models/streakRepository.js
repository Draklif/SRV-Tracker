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

module.exports = { get, findByUser, upsert };
