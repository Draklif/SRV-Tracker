'use strict';

const cosmeticRepository = require('../models/cosmeticRepository');
const shopPurchaseRepository = require('../models/shopPurchaseRepository');
const userRepository = require('../models/userRepository');
const lootboxRepository = require('../models/lootboxRepository');
const cosmeticsService = require('./cosmeticsService');
const coinService = require('./coinService');
const discountService = require('./discountService');
const lootboxService = require('./lootboxService');
const catalogService = require('./catalogService');
const withTransaction = require('../database/withTransaction');
const { parseEquipped } = require('../utils/equipped');
const { todayFor } = require('../utils/date');
const { NotFoundError, ConflictError, ForbiddenError } = require('../utils/errors');
const { SLOTS, SLOT_KEYS, RARITY_KEYS } = require('../config/cosmetics');

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
  const day = todayFor(userRow && userRow.timezone);

  // Los objetos ocultos (exclusivos del pase) no se venden: fuera del catálogo.
  const forSale = catalogService.items().filter((item) => !item.hidden);
  const totalCount = forSale.length;

  const slots = SLOT_KEYS.map((slot) => ({
    key: slot,
    label: SLOTS[slot].label,
    desc: SLOTS[slot].desc,
    equippedKey: equipped[slot] || null,
    items: forSale
      .filter((item) => item.slot === slot)
      .map((item) => {
        const discount = discountService.discountFor(item.key, day);
        const price = discountService.effectivePrice(item, day);
        return {
          ...item,
          price, // el precio EFECTIVO: lo que se cobra y lo que decide si alcanza
          priceOriginal: item.price, // el de catálogo, para tacharlo si hay rebaja
          discount: discount ? discount.percent : 0,
          owned: owned.has(item.key),
          affordable: balance >= price,
        };
      })
      .sort(
        (a, b) =>
          RARITY_KEYS.indexOf(a.rarity) - RARITY_KEYS.indexOf(b.rarity) || a.price - b.price
      ),
  }));

  // Cajas: precio de catálogo (sin rotación de rebajas), su vista previa (pool +
  // probabilidades, para pintarla en el servidor) y cuántas sin abrir tienes.
  // Las cajas de admin deshabilitadas no se muestran.
  const boxCounts = lootboxRepository.countsFor(userId);
  const boxes = catalogService
    .boxes()
    .filter((box) => box.enabled !== false)
    .map((box) => ({
      ...lootboxService.preview(box.key), // key, name, desc, price, rarityOdds, items
      affordable: balance >= box.price,
      owned: boxCounts[box.key] || 0,
    }));

  return {
    slots,
    boxes,
    balance,
    ownedCount: owned.size,
    totalCount,
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
  const item = catalogService.itemsByKey()[itemKey];
  if (!item) throw new NotFoundError('Ese objeto no existe.');
  // Un objeto oculto no está a la venta aunque el cliente sepa su clave.
  if (item.hidden || !(item.price > 0)) throw new ForbiddenError('Ese objeto no está a la venta.');

  const day = todayFor(user.timezone);
  // El precio lo pone el servidor con el descuento vigente: el cliente no cobra.
  const price = discountService.effectivePrice(item, day);

  return withTransaction(() => {
    if (cosmeticRepository.owns(user.id, itemKey)) {
      throw new ConflictError('Ya tienes ese objeto.');
    }
    if (!userRepository.spendCoins(user.id, price)) {
      throw new ConflictError('Todavía no te alcanzan las monedas para eso.');
    }

    shopPurchaseRepository.insert({
      user_id: user.id,
      item_key: itemKey,
      price, // lo que costó EN SU MOMENTO (con la rebaja aplicada)
      day,
    });
    cosmeticsService.grant(user.id, itemKey, 'shop');

    return {
      itemKey,
      name: item.name,
      price,
      balance: coinService.balance(user.id),
    };
  });
}

module.exports = { catalogFor, buy };
