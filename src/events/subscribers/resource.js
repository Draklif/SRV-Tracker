'use strict';

const bus = require('../eventBus');
const EVENTS = require('../events');
const resourceService = require('../../services/resourceService');
const logger = require('../../utils/logger');

/**
 * Subscriber de recursos: cada avance en un hábito genera el recurso asociado
 * y lo acumula en la pool (por usuario) para la futura aldea. No escribe en
 * `ctx.rewards`, así que no afecta a los toasts ni al orden con otros
 * subscribers. Un fallo aquí nunca debe romper el registro del hábito.
 */
function register() {
  bus.on(EVENTS.HABIT_LOGGED, (ctx) => {
    try {
      resourceService.processLog(ctx);
    } catch (err) {
      logger.error('[resource] al procesar log:', err.message);
    }
  });
}

module.exports = { register };
