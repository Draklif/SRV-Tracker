'use strict';

const bus = require('../eventBus');
const EVENTS = require('../events');
const villageService = require('../../services/villageService');
const logger = require('../../utils/logger');

/**
 * Subscriber de la colonia: cada avance en un hábito aporta el recurso asociado
 * al tesoro compartido de la colonia del usuario (si pertenece a una). Como el
 * subscriber de recursos, es side-effect only: no escribe en `ctx.rewards`, así
 * que no afecta a los toasts ni al orden con otros subscribers. Un fallo aquí
 * nunca debe romper el registro del hábito.
 */
function register() {
  bus.on(EVENTS.HABIT_LOGGED, (ctx) => {
    try {
      villageService.creditContribution(ctx);
    } catch (err) {
      logger.error('[village] al procesar aporte:', err.message);
    }
  });
}

module.exports = { register };
