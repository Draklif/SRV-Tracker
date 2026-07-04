'use strict';

const xpEventRepository = require('../models/xpEventRepository');
const userRepository = require('../models/userRepository');
const achievementService = require('./achievementService');
const dashboardService = require('./dashboardService');
const withTransaction = require('../database/withTransaction');
const { XP_RULES } = require('../config/constants');
const { levelFromXp, levelProgress } = require('../utils/level');
const { isProgress } = require('../utils/logProgress');

/**
 * Otorga XP de forma idempotente (índice único user+reason+source+day).
 * Devuelve la cantidad realmente otorgada (0 si ya existía). Nunca resta.
 */
function award(userId, amount, reason, sourceType, sourceId, day) {
  if (amount <= 0) return 0;
  const inserted = xpEventRepository.insertIfNew({
    user_id: userId,
    amount,
    reason,
    source_type: sourceType,
    source_id: sourceId,
    day,
  });
  if (!inserted) return 0;
  userRepository.addXp(userId, amount);
  return amount;
}

/**
 * Procesa las recompensas de un registro de hábito: XP por registrar, por
 * meta diaria, por día completo y por hitos de racha; luego evalúa logros.
 * Todo en una transacción. Devuelve el resumen para los toasts del cliente.
 */
function processLog({ user, habit, log, streak, date }) {
  return withTransaction(() => {
    const xpBefore = userRepository.findById(user.id).xp;
    let gained = 0;

    // Solo se premia el avance real, nunca el retroceso ni un valor en 0/vacío
    // (clear/desmarcar/poner en 0 no tocan XP).
    if (isProgress(log)) {
      gained += award(user.id, XP_RULES.HABIT_LOG, 'habit_log', 'habit', habit.id, date);

      if (log.completed) {
        gained += award(user.id, XP_RULES.DAILY_TARGET, 'daily_target', 'habit', habit.id, date);

        const milestone = XP_RULES.STREAK_MILESTONES[streak.current_streak];
        if (milestone) {
          gained += award(user.id, milestone, 'streak_milestone', 'habit', habit.id, date);
        }

        const dp = dashboardService.dayProgress(user.id, date);
        if (dp.total > 0 && dp.done === dp.total) {
          gained += award(user.id, XP_RULES.DAY_COMPLETE, 'day_complete', 'day', 0, date);
        }
      }
    }

    // Logros (pueden otorgar XP extra al desbloquearse).
    const unlocked = achievementService.evaluate(user.id, date);
    for (const ach of unlocked) {
      gained += award(user.id, ach.xp_reward, 'achievement', 'achievement', ach.id, date);
    }

    const xpAfter = userRepository.findById(user.id).xp;
    const levelBefore = levelFromXp(xpBefore);
    const progress = levelProgress(xpAfter);

    return {
      xpGained: gained,
      leveledUp: progress.level > levelBefore ? progress.level : null,
      progress,
      achievements: unlocked.map((a) => ({ name: a.name, icon: a.icon, description: a.description })),
    };
  });
}

/** Recompensas al crear un hábito: solo evaluación de logros (coleccionista…). */
function processHabitCreated({ user, date }) {
  return withTransaction(() => {
    const xpBefore = userRepository.findById(user.id).xp;
    let gained = 0;

    const unlocked = achievementService.evaluate(user.id, date);
    for (const ach of unlocked) {
      gained += award(user.id, ach.xp_reward, 'achievement', 'achievement', ach.id, date);
    }

    const xpAfter = userRepository.findById(user.id).xp;
    const progress = levelProgress(xpAfter);
    return {
      xpGained: gained,
      leveledUp: progress.level > levelFromXp(xpBefore) ? progress.level : null,
      progress,
      achievements: unlocked.map((a) => ({ name: a.name, icon: a.icon, description: a.description })),
    };
  });
}

module.exports = { award, processLog, processHabitCreated };
