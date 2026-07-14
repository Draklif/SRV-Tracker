'use strict';

const bus = require('../eventBus');
const EVENTS = require('../events');
const coinService = require('../../services/coinService');
const logger = require('../../utils/logger');

/**
 * Subscriber de monedas. Corre SIEMPRE DESPUÉS de gamificación (ver
 * subscribers/index.js): lee las filas de xp_events que aquella acaba de
 * escribir —`emit` es síncrono y su transacción ya cerró— y acuña la moneda que
 * les falta. No recalcula ni una regla del XP; solo lo sigue.
 *
 * Escribe en ctx.rewards MEZCLANDO, nunca sobrescribiendo: gamificación ya dejó
 * ahí xpGained/leveledUp/achievements/progress y el cliente los espera intactos.
 * Solo escribe si hubo ganancia, así que para quien no gana nada ctx.rewards
 * sigue siendo null y la app se comporta exactamente igual que antes.
 *
 * Un fallo aquí no puede romper el registro de un hábito: se captura, y como la
 * acuñación es una reconciliación, el siguiente registro de ese día recupera lo
 * que se quedó sin acuñar.
 */
function mint(ctx) {
  const coinsGained = coinService.mintForDay(ctx.user.id, ctx.date);
  if (coinsGained > 0) {
    ctx.rewards = { ...(ctx.rewards || {}), coinsGained };
  }
}

function register() {
  bus.on(EVENTS.HABIT_LOGGED, (ctx) => {
    try {
      mint(ctx);
    } catch (err) {
      logger.error('[coins] al acuñar tras un registro:', err.message);
    }
  });

  // Crear un hábito puede desbloquear un logro, y un logro da XP → da monedas.
  // Es la misma llamada: a la reconciliación le da igual de dónde salió el premio.
  bus.on(EVENTS.HABIT_CREATED, (ctx) => {
    try {
      mint(ctx);
    } catch (err) {
      logger.error('[coins] al acuñar tras crear un hábito:', err.message);
    }
  });
}

module.exports = { register };
