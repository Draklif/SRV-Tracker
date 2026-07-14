'use strict';

const { XP_RULES, COIN_RULES } = require('../config/constants');

/**
 * La regla de la moneda, pura y sin BD. Es el ÚNICO sitio donde vive, y de ahí
 * beben tanto el subscriber en vivo (src/events/subscribers/coins.js) como el
 * backfill (src/database/seeds/backfillCoins.js). Por eso los dos acuñan
 * exactamente lo mismo y se puede probar sin levantar nada.
 */

/**
 * Inversa de XP_RULES.STREAK_MILESTONES: xp => días.
 *
 * Hace falta porque una fila de xp_events guarda CUÁNTO XP se dio, no de qué
 * hito era. Se puede invertir porque los cinco valores (25/40/60/80/100) son
 * distintos entre sí — y eso lo blinda un test, porque si alguien pusiera dos
 * hitos con el mismo XP este mapa se comería uno en silencio y el backfill
 * repartiría las monedas del hito equivocado.
 */
const STREAK_DAYS_BY_XP = Object.freeze(
  Object.fromEntries(
    Object.entries(XP_RULES.STREAK_MILESTONES).map(([days, xp]) => [xp, Number(days)])
  )
);

/**
 * Monedas BASE que corresponden a un premio de XP ya concedido.
 *
 * La entrada es una fila de xp_events ({ reason, amount }), no un hecho del
 * dominio: el ledger de XP es la fuente. Por eso esta misma función sirve para
 * acuñar en vivo y para replicar el pasado, y por eso la moneda no reimplementa
 * ni una sola regla de gamificationService.
 *
 * Un motivo desconocido da 0: si mañana aparece un premio de XP nuevo, la moneda
 * no se lo inventa sola — hay que decidirlo aquí a mano.
 */
function coinsForXpEvent(event) {
  if (!event) return 0;
  switch (event.reason) {
    case 'habit_log':
      return COIN_RULES.HABIT_LOG;
    case 'daily_target':
      return COIN_RULES.DAILY_TARGET;
    case 'day_complete':
      return COIN_RULES.DAY_COMPLETE;
    case 'achievement':
      // Plano a propósito: el logro no paga en proporción a su XP. Su valor es
      // haberlo desbloqueado, y así añadir un logro no reajusta la economía.
      return COIN_RULES.ACHIEVEMENT;
    case 'streak_milestone': {
      const days = STREAK_DAYS_BY_XP[event.amount];
      return days ? COIN_RULES.STREAK_MILESTONES[days] || 0 : 0;
    }
    default:
      return 0;
  }
}

/**
 * Aplica el multiplicador del entorno (config.economy.coinRate) al acuñar.
 * El suelo de 1 evita que un rate pequeño (0.2) haga desaparecer un premio de 2
 * monedas: un premio que existe nunca puede valer cero.
 */
function scaleCoins(base, rate) {
  if (!(base > 0) || !(rate > 0)) return 0;
  return Math.max(1, Math.round(base * rate));
}

module.exports = { coinsForXpEvent, scaleCoins, STREAK_DAYS_BY_XP };
