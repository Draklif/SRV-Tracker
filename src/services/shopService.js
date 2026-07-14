'use strict';

const cosmeticRepository = require('../models/cosmeticRepository');
const shopPurchaseRepository = require('../models/shopPurchaseRepository');
const userRepository = require('../models/userRepository');
const cosmeticsService = require('./cosmeticsService');
const coinService = require('./coinService');
const withTransaction = require('../database/withTransaction');
const { parseEquipped } = require('../utils/equipped');
const { todayFor } = require('../utils/date');
const { NotFoundError, ConflictError, ForbiddenError } = require('../utils/errors');
const { ITEMS, ITEMS_BY_KEY, SLOTS, SLOT_KEYS, RARITY_KEYS } = require('../config/cosmetics');

/**
 * La tienda. Vende el mismo catálogo que enseña la colección (src/config/cosmetics.js),
 * y todo lo que vende es decoración: nada de aquí da XP ni ventaja.
 *
 * El cliente solo manda una CLAVE. El precio, el saldo y la propiedad los decide
 * siempre el servidor: si el navegador pudiera opinar sobre el precio, la
 * economía no existiría.
 */

/**
 * El catálogo con precio, propiedad y si te alcanza. Es lo que pinta /tienda.
 * Ordena por rareza y, dentro de ella, por precio: lo asequible primero.
 */
function catalogFor(userId, userRow) {
  const owned = new Set(cosmeticRepository.ownedKeys(userId));
  const equipped = parseEquipped(userRow && userRow.cosmetics);
  const balance = (userRow && userRow.coins) || 0;

  const slots = SLOT_KEYS.map((slot) => ({
    key: slot,
    label: SLOTS[slot].label,
    desc: SLOTS[slot].desc,
    equippedKey: equipped[slot] || null,
    items: ITEMS.filter((item) => item.slot === slot)
      .map((item) => ({ ...item, owned: owned.has(item.key), affordable: balance >= item.price }))
      .sort(
        (a, b) =>
          RARITY_KEYS.indexOf(a.rarity) - RARITY_KEYS.indexOf(b.rarity) || a.price - b.price
      ),
  }));

  return {
    slots,
    balance,
    ownedCount: owned.size,
    totalCount: ITEMS.length,
  };
}

/**
 * Compra un objeto. TODO ocurre dentro de una transacción, así que o pasa entero
 * o no pasa nada: no existe el estado "te cobré pero no te lo di".
 *
 * El cobro y la comprobación de saldo son EL MISMO UPDATE (userRepository.spendCoins:
 * `... WHERE id = ? AND coins >= ?`). Comprobar y luego restar en dos pasos dejaría
 * una rendija entre ambos por la que dos compras a la vez podrían dejar el saldo
 * en negativo; así no hay rendija.
 */
function buy(user, itemKey) {
  const item = ITEMS_BY_KEY[itemKey];
  if (!item) throw new NotFoundError('Ese objeto no existe.');
  if (!(item.price > 0)) throw new ForbiddenError('Ese objeto no está a la venta.');

  const day = todayFor(user.timezone);

  return withTransaction(() => {
    if (cosmeticRepository.owns(user.id, itemKey)) {
      throw new ConflictError('Ya tienes ese objeto.');
    }
    if (!userRepository.spendCoins(user.id, item.price)) {
      throw new ConflictError('Todavía no te alcanzan las monedas para eso.');
    }

    shopPurchaseRepository.insert({
      user_id: user.id,
      item_key: itemKey,
      price: item.price,
      day,
    });
    cosmeticsService.grant(user.id, itemKey, 'shop');

    return {
      itemKey,
      name: item.name,
      price: item.price,
      balance: coinService.balance(user.id),
    };
  });
}

module.exports = { catalogFor, buy };
