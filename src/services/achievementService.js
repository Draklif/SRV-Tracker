'use strict';

const db = require('../database/connection');
const achievementRepository = require('../models/achievementRepository');
const xpEventRepository = require('../models/xpEventRepository');
const { levelFromXp } = require('../utils/level');

/**
 * Logros data-driven: cada fila de `achievements` trae un `criteria` JSON
 * ({type, value}) que se evalúa con uno de estos evaluadores. Añadir un logro
 * nuevo = añadir una fila (y, si hace falta, un evaluador aquí).
 */

const queries = {
  logsCount: db.prepare('SELECT COUNT(*) AS n FROM habit_logs WHERE user_id = ? AND completed = 1'),
  maxStreak: db.prepare(`
    SELECT COALESCE(MAX(hs.current_streak), 0) AS n
    FROM habit_streaks hs JOIN habits h ON h.id = hs.habit_id
    WHERE h.user_id = ?
  `),
  habitsCount: db.prepare('SELECT COUNT(*) AS n FROM habits WHERE user_id = ?'),
  userXp: db.prepare('SELECT xp FROM users WHERE id = ?'),
};

const evaluators = {
  logs_count: (userId, value) => queries.logsCount.get(userId).n >= value,
  streak: (userId, value) => queries.maxStreak.get(userId).n >= value,
  habits_count: (userId, value) => queries.habitsCount.get(userId).n >= value,
  day_complete_count: (userId, value) => xpEventRepository.countByReason(userId, 'day_complete') >= value,
  level: (userId, value) => levelFromXp(queries.userXp.get(userId).xp) >= value,
};

/**
 * Evalúa los logros aún no desbloqueados del usuario y desbloquea los que
 * cumplan su criterio. Devuelve los recién desbloqueados (filas completas).
 */
function evaluate(userId) {
  const unlockedBefore = achievementRepository.unlockedIds(userId);
  const fresh = [];

  for (const ach of achievementRepository.listActive()) {
    if (unlockedBefore.has(ach.id)) continue;

    let criteria;
    try {
      criteria = JSON.parse(ach.criteria);
    } catch {
      continue;
    }
    const evaluator = evaluators[criteria.type];
    if (!evaluator || !evaluator(userId, criteria.value)) continue;

    if (achievementRepository.unlock(userId, ach.id)) fresh.push(ach);
  }

  return fresh;
}

/** Logros con estado de desbloqueo, para la página de perfil. */
function listForUser(userId) {
  return achievementRepository.listForUser(userId);
}

module.exports = { evaluate, listForUser };
