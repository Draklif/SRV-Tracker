'use strict';

const bus = require('../eventBus');
const EVENTS = require('../events');
const gamificationService = require('../../services/gamificationService');
const logger = require('../../utils/logger');

/**
 * Subscriber de gamificación: convierte hechos del dominio en XP y logros.
 * Escribe su resultado en `ctx.rewards` (emit es síncrono) para que el emisor
 * pueda devolverlo al cliente y mostrar toasts. Un fallo aquí nunca debe
 * romper el registro del hábito: se captura y se registra.
 */
function register() {
  bus.on(EVENTS.HABIT_LOGGED, (ctx) => {
    try {
      ctx.rewards = gamificationService.processLog(ctx);
    } catch (err) {
      logger.error('[gamification] al procesar log:', err.message);
    }
  });

  bus.on(EVENTS.HABIT_CREATED, (ctx) => {
    try {
      ctx.rewards = gamificationService.processHabitCreated(ctx);
    } catch (err) {
      logger.error('[gamification] al procesar creación:', err.message);
    }
  });
}

module.exports = { register };
