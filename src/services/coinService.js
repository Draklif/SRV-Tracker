'use strict';

const coinEventRepository = require('../models/coinEventRepository');
const shopPurchaseRepository = require('../models/shopPurchaseRepository');
const userRepository = require('../models/userRepository');
const withTransaction = require('../database/withTransaction');
const config = require('../config');
const { coinsForXpEvent, scaleCoins } = require('../utils/coinRules');

/**
 * Monedas. Es una capa PARÁSITA del XP, y ese es todo el diseño:
 *
 * No reimplementa ni una regla de gamificationService. No sabe qué es una racha
 * ni un día completo. Solo mira el ledger de XP —que ya es la verdad, ya está
 * deduplicado y ya lo escribió quien manda— y acuña la moneda que le falta a
 * cada premio. Si mañana cambian las reglas del XP, la moneda las sigue sola.
 *
 * De ahí salen tres propiedades gratis:
 *   - el subscriber en vivo y el backfill son LA MISMA función (solo cambia si
 *     se acota al día o no);
 *   - es idempotente (NOT EXISTS + índice único: cinturón y tirantes);
 *   - se autorrepara: si un día falla el subscriber, el siguiente registro de
 *     ese día acuña lo que se quedó sin acuñar.
 */

/** Acuña las monedas de unas filas de xp_events. Devuelve cuántas se dieron. */
function mintRows(userId, rows) {
  let gained = 0;
  for (const row of rows) {
    const amount = scaleCoins(coinsForXpEvent(row), config.economy.coinRate);
    if (amount <= 0) continue;
    const inserted = coinEventRepository.insertIfNew({
      user_id: userId,
      amount,
      reason: row.reason,
      source_type: row.source_type,
      source_id: row.source_id,
      day: row.day,
    });
    if (inserted) gained += amount;
  }
  if (gained > 0) userRepository.addCoins(userId, gained);
  return gained;
}

/** Acuña lo que le falte al usuario de UN día. Devuelve las monedas ganadas. */
function mintForDay(userId, day) {
  return withTransaction(() => mintRows(userId, coinEventRepository.pendingForDay(userId, day)));
}

/** Acuña lo que le falte al usuario de SIEMPRE (backfill). Idempotente. */
function mintAll(userId) {
  return withTransaction(() => mintRows(userId, coinEventRepository.pendingAll(userId)));
}

/** Saldo actual (el contador denormalizado de users.coins). */
function balance(userId) {
  const user = userRepository.findById(userId);
  return user ? user.coins : 0;
}

/**
 * El saldo reconstruido desde la verdad: ganado menos gastado. Debe coincidir
 * siempre con balance(); si no, el contador se ha desincronizado del ledger.
 */
function auditBalance(userId) {
  return coinEventRepository.totalByUser(userId) - shopPurchaseRepository.totalSpent(userId);
}

module.exports = { mintForDay, mintAll, balance, auditBalance };
