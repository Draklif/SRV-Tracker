'use strict';

const coinEventRepository = require('../models/coinEventRepository');
const coinSpendRepository = require('../models/coinSpendRepository');
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

/**
 * Acredita monedas que NO nacen de un premio de XP (recompensa del pase,
 * reembolso de un duplicado de caja). Escribe en el ledger (para que el saldo
 * siga cuadrando con la invariante SUM(coin_events) - SUM(shop_purchases)) y
 * sube el contador denormalizado. Idempotencia y atomicidad las pone quien
 * llama: se invoca siempre dentro de la transacción del pase/caja, y el
 * source_id monótono evita chocar con el índice único del ledger.
 *
 * Devuelve las monedas acreditadas (0 si amount <= 0).
 */
function credit(userId, amount, reason, day) {
  if (!(amount > 0)) return 0;
  const sourceId = coinEventRepository.countByUserReason(userId, reason) + 1;
  coinEventRepository.insertCredit({
    user_id: userId,
    amount,
    reason,
    source_type: reason,
    source_id: sourceId,
    day,
  });
  userRepository.addCoins(userId, amount);
  return amount;
}

/**
 * Gasta monedas que NO son la compra de un cosmético (una caja, el premium del
 * pase). Es el cobro con guarda (spendCoins: `... WHERE coins >= ?`, atómico) MÁS
 * el apunte en el ledger de gastos, para que el saldo siga cuadrando con la
 * invariante. Devuelve true si había saldo (y se cobró). Debe llamarse dentro de
 * la transacción del que gasta.
 */
function spend(userId, amount, reason, ref, day) {
  if (!(amount > 0)) return true; // gasto nulo: nada que cobrar ni registrar
  if (!userRepository.spendCoins(userId, amount)) return false;
  coinSpendRepository.insert({ user_id: userId, amount, reason, ref, day });
  return true;
}

/** Saldo actual (el contador denormalizado de users.coins). */
function balance(userId) {
  const user = userRepository.findById(userId);
  return user ? user.coins : 0;
}

/**
 * El saldo reconstruido desde la verdad: ganado menos gastado. Debe coincidir
 * siempre con balance(); si no, el contador se ha desincronizado del ledger.
 * Se gasta por dos vías: la tienda (shop_purchases) y todo lo demás (coin_spends).
 */
function auditBalance(userId) {
  return (
    coinEventRepository.totalByUser(userId) -
    shopPurchaseRepository.totalSpent(userId) -
    coinSpendRepository.totalByUser(userId)
  );
}

module.exports = { mintForDay, mintAll, credit, spend, balance, auditBalance };
