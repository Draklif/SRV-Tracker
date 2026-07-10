'use strict';

const habitService = require('./habitService');
const streakService = require('./streakService');
const activityService = require('./activityService');
const habitLogRepository = require('../models/habitLogRepository');
const { todayFor, weekStart } = require('../utils/date');
const { levelProgress } = require('../utils/level');
const { getSchedule, isRequiredOn, isRestDay } = require('../utils/schedule');

function indexBy(rows, key) {
  const map = {};
  for (const row of rows) map[row[key]] = row;
  return map;
}

/** Progreso del día: solo cuentan los hábitos obligatorios ese día. */
function dayProgressFrom(items) {
  const required = items.filter((i) => i.required);
  const done = required.filter((i) => i.log && i.log.completed).length;
  const total = required.length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

/** Nº de días completados esta semana (para la cuota de hábitos "N/semana"). */
function weekCompletedCount(habitId, today) {
  const rows = habitLogRepository.findByHabitSince(habitId, weekStart(today));
  return rows.filter((r) => r.completed).length;
}

/**
 * Progreso semanal: cuántos hábitos "N veces/semana" ya cumplieron su cuota
 * esta semana, sobre el total de hábitos semanales. Análogo al anillo diario.
 */
function weekProgressFrom(items) {
  const weekly = items.filter((i) => i.schedule && i.schedule.type === 'weekly');
  const done = weekly.filter((i) => (i.weekDone || 0) >= i.weekTarget).length;
  const total = weekly.length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

/** Datos completos del dashboard para un usuario: hábitos con su estado de hoy. */
function assemble(user) {
  const today = todayFor(user.timezone);
  const habits = habitService.listActive(user.id);
  const logs = indexBy(habitLogRepository.findByUserAndDate(user.id, today), 'habit_id');
  const streaks = indexBy(streakService.findByUser(user.id), 'habit_id');

  const items = habits.map((h) => {
    const schedule = getSchedule(h);
    const item = {
      ...h,
      schedule,
      required: isRequiredOn(schedule, today),
      restToday: isRestDay(schedule, today),
      log: logs[h.id] || null,
      streak: streaks[h.id] || { current_streak: 0, longest_streak: 0 },
    };
    if (schedule.type === 'weekly') {
      item.weekTarget = schedule.timesPerWeek;
      item.weekDone = weekCompletedCount(h.id, today);
    }
    return item;
  });

  return {
    today,
    habits: items,
    dayProgress: dayProgressFrom(items),
    weekProgress: weekProgressFrom(items),
    level: levelProgress(user.xp),
    activity: activityService.feed(user.id, 5),
  };
}

/** Progreso del día (hecho/total) — usado tras registrar un hábito. */
function dayProgress(userId, date) {
  const habits = habitService.listActive(userId);
  const logs = indexBy(habitLogRepository.findByUserAndDate(userId, date), 'habit_id');
  const items = habits.map((h) => ({
    required: isRequiredOn(getSchedule(h), date),
    log: logs[h.id] || null,
  }));
  return dayProgressFrom(items);
}

/** Progreso semanal (cuotas cumplidas) — usado tras registrar un hábito. */
function weekProgress(userId, date) {
  const items = habitService.listActive(userId).map((h) => {
    const schedule = getSchedule(h);
    const item = { schedule };
    if (schedule.type === 'weekly') {
      item.weekTarget = schedule.timesPerWeek;
      item.weekDone = weekCompletedCount(h.id, date);
    }
    return item;
  });
  return weekProgressFrom(items);
}

module.exports = { assemble, dayProgress, weekProgress, weekCompletedCount };
