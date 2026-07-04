'use strict';

const habitService = require('./habitService');
const streakService = require('./streakService');
const habitLogRepository = require('../models/habitLogRepository');
const { todayFor } = require('../utils/date');
const { levelProgress } = require('../utils/level');

function indexBy(rows, key) {
  const map = {};
  for (const row of rows) map[row[key]] = row;
  return map;
}

function dayProgressFrom(items) {
  const total = items.length;
  const done = items.filter((i) => i.log && i.log.completed).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

/** Datos completos del dashboard para un usuario: hábitos con su estado de hoy. */
function assemble(user) {
  const today = todayFor(user.timezone);
  const habits = habitService.listActive(user.id);
  const logs = indexBy(habitLogRepository.findByUserAndDate(user.id, today), 'habit_id');
  const streaks = indexBy(streakService.findByUser(user.id), 'habit_id');

  const items = habits.map((h) => ({
    ...h,
    log: logs[h.id] || null,
    streak: streaks[h.id] || { current_streak: 0, longest_streak: 0 },
  }));

  return {
    today,
    habits: items,
    dayProgress: dayProgressFrom(items),
    level: levelProgress(user.xp),
  };
}

/** Progreso del día (hecho/total) — usado tras registrar un hábito. */
function dayProgress(userId, date) {
  const habits = habitService.listActive(userId);
  const logs = indexBy(habitLogRepository.findByUserAndDate(userId, date), 'habit_id');
  const items = habits.map((h) => ({ log: logs[h.id] || null }));
  return dayProgressFrom(items);
}

module.exports = { assemble, dayProgress };
