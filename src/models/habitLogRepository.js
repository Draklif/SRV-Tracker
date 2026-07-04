'use strict';

const db = require('../database/connection');

/**
 * Acceso a datos de registros diarios (`habit_logs`). Una fila por hábito y día
 * (UNIQUE habit_id + log_date); los avances se escriben con upsert.
 */

const statements = {
  upsert: db.prepare(`
    INSERT INTO habit_logs (habit_id, user_id, log_date, value_num, value_text, completed)
    VALUES (@habit_id, @user_id, @log_date, @value_num, @value_text, @completed)
    ON CONFLICT(habit_id, log_date) DO UPDATE SET
      value_num = excluded.value_num,
      value_text = excluded.value_text,
      completed = excluded.completed,
      updated_at = datetime('now')
  `),
  get: db.prepare('SELECT * FROM habit_logs WHERE habit_id = ? AND log_date = ?'),
  byUserDate: db.prepare('SELECT * FROM habit_logs WHERE user_id = ? AND log_date = ?'),
  completedDates: db.prepare(
    'SELECT log_date FROM habit_logs WHERE habit_id = ? AND completed = 1 ORDER BY log_date'
  ),
  remove: db.prepare('DELETE FROM habit_logs WHERE habit_id = ? AND log_date = ?'),
  byHabitSince: db.prepare(
    'SELECT * FROM habit_logs WHERE habit_id = ? AND log_date >= ? ORDER BY log_date'
  ),
  recentByHabit: db.prepare(
    'SELECT * FROM habit_logs WHERE habit_id = ? ORDER BY log_date DESC LIMIT ?'
  ),
  statsByHabit: db.prepare(`
    SELECT COUNT(*) AS total,
           SUM(completed) AS done,
           AVG(CASE WHEN value_num IS NOT NULL THEN value_num END) AS avg_value,
           MAX(value_num) AS max_value
    FROM habit_logs WHERE habit_id = ?
  `),
};

function upsert(row) {
  statements.upsert.run(row);
  return statements.get.get(row.habit_id, row.log_date);
}

function get(habitId, date) {
  return statements.get.get(habitId, date);
}

function findByUserAndDate(userId, date) {
  return statements.byUserDate.all(userId, date);
}

function completedDates(habitId) {
  return statements.completedDates.all(habitId).map((r) => r.log_date);
}

function remove(habitId, date) {
  statements.remove.run(habitId, date);
}

function findByHabitSince(habitId, fromDate) {
  return statements.byHabitSince.all(habitId, fromDate);
}

function findRecentByHabit(habitId, limit) {
  return statements.recentByHabit.all(habitId, limit);
}

function statsByHabit(habitId) {
  return statements.statsByHabit.get(habitId);
}

module.exports = {
  upsert,
  get,
  findByUserAndDate,
  completedDates,
  remove,
  findByHabitSince,
  findRecentByHabit,
  statsByHabit,
};
