'use strict';

const bus = require('../eventBus');
const EVENTS = require('../events');
const activityService = require('../../services/activityService');
const realtimeService = require('../../services/realtimeService');
const { ACTIVITY_TYPES, XP_RULES } = require('../../config/constants');
const logger = require('../../utils/logger');

/**
 * Subscriber del feed: convierte hechos del dominio en historias celebrables.
 * Se registra DESPUÉS de gamificación para poder leer ctx.rewards (emit es
 * síncrono y respeta el orden). Cada evento nuevo se anuncia por SSE.
 */

function announce(event) {
  if (event) realtimeService.broadcast('activity', { id: event.id });
}

function register() {
  bus.on(EVENTS.HABIT_LOGGED, (ctx) => {
    try {
      const { user, habit, streak, date, newlyCompleted, rewards } = ctx;

      // "Carlos terminó su agua" — solo al completarse (no en cada +250) y 1×/día.
      if (newlyCompleted) {
        announce(
          activityService.recordOncePerDay(user.id, ACTIVITY_TYPES.HABIT_COMPLETED, habit.id, date, {
            habitName: habit.name,
            icon: habit.icon,
            color: habit.color,
          })
        );

        // "José alcanzó 30 días de lectura" — solo en hitos.
        if (XP_RULES.STREAK_MILESTONES[streak.current_streak]) {
          announce(
            activityService.recordOncePerDay(user.id, ACTIVITY_TYPES.STREAK_MILESTONE, habit.id, date, {
              habitName: habit.name,
              icon: habit.icon,
              days: streak.current_streak,
            })
          );
        }
      }

      // Subida de nivel y logros (calculados por el subscriber de gamificación).
      if (rewards && rewards.leveledUp) {
        announce(activityService.record(user.id, ACTIVITY_TYPES.LEVEL_UP, { level: rewards.leveledUp }));
      }
      for (const ach of (rewards && rewards.achievements) || []) {
        announce(
          activityService.record(user.id, ACTIVITY_TYPES.ACHIEVEMENT_UNLOCKED, {
            name: ach.name,
            icon: ach.icon,
          })
        );
      }
    } catch (err) {
      logger.error('[activity] al procesar log:', err.message);
    }
  });
}

module.exports = { register };
