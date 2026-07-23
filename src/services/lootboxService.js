'use strict';

const cosmeticRepository = require('../models/cosmeticRepository');
const lootboxRepository = require('../models/lootboxRepository');
const cosmeticsService = require('./cosmeticsService');
const coinService = require('./coinService');
const catalogService = require('./catalogService');
const withTransaction = require('../database/withTransaction');
const { todayFor } = require('../utils/date');
const { NotFoundError, ConflictError } = require('../utils/errors');
const { RARITIES, RARITY_KEYS } = require('../config/cosmetics');
const { DUP_REFUND } = require('../config/lootboxes');

/**
 * Cajas (lootboxes). El cliente solo manda la clave de la caja; la TIRADA la
 * decide siempre el servidor (los pesos viven en RARITIES), dentro de una
 * transacción: o se cobra Y se concede, o no pasa nada.
 *
 * Si sale un objeto que ya tienes, no se concede: se reembolsa en monedas según
 * DUP_REFUND. Así abrir una caja nunca se desperdicia.
 */

/** Los objetos del pool resueltos contra el catálogo (ignora claves muertas). */
function poolItems(box) {
  const byKey = catalogService.itemsByKey();
  return box.pool.map((key) => byKey[key]).filter(Boolean);
}

/** Agrupa el pool por rareza, en orden canónico. */
function groupByRarity(items) {
  const groups = new Map();
  for (const it of items) {
    if (!groups.has(it.rarity)) groups.set(it.rarity, []);
    groups.get(it.rarity).push(it);
  }
  // Reordena las claves por el orden canónico de rareza.
  return RARITY_KEYS.filter((r) => groups.has(r)).map((r) => ({ rarity: r, items: groups.get(r) }));
}

/**
 * Vista previa de una caja para el modal de la tienda: qué puede salir, AGRUPADO
 * por rareza y con la probabilidad de cada grupo. La probabilidad de una rareza
 * es su peso entre la suma de los pesos de las rarezas PRESENTES en el pool; la
 * de un objeto, esa entre los de su rareza.
 */
function preview(boxKey) {
  const box = catalogService.boxesByKey()[boxKey];
  if (!box) throw new NotFoundError('Esa caja no existe.');

  const grouped = groupByRarity(poolItems(box));
  const totalWeight = grouped.reduce((sum, g) => sum + RARITIES[g.rarity].weight, 0) || 1;

  const groups = grouped.map((g) => {
    const rarityChance = RARITIES[g.rarity].weight / totalWeight;
    const label = RARITIES[g.rarity].label;
    const color = RARITIES[g.rarity].color;
    return {
      rarity: g.rarity,
      label,
      color,
      percent: Math.round(rarityChance * 1000) / 10, // 1 decimal
      items: g.items.map((it) => ({
        ...it,
        rarityLabel: label,
        color,
        chance: Math.round((rarityChance / g.items.length) * 1000) / 10,
      })),
    };
  });

  return { key: box.key, name: box.name, desc: box.desc, price: box.price, art: box.art, groups };
}

/** Una tirada: elige rareza por peso entre las presentes, luego objeto uniforme. */
function roll(box) {
  const groups = groupByRarity(poolItems(box));
  const totalWeight = groups.reduce((sum, g) => sum + RARITIES[g.rarity].weight, 0);

  let r = Math.random() * totalWeight;
  let chosen = groups[0];
  for (const g of groups) {
    r -= RARITIES[g.rarity].weight;
    if (r < 0) {
      chosen = g;
      break;
    }
  }
  return chosen.items[Math.floor(Math.random() * chosen.items.length)];
}

/**
 * Abre una caja y devuelve lo que salió. `fromInventory` decide de dónde se paga:
 *   - false (tienda): cuesta box.price en monedas.
 *   - true (inventario): consume una caja ganada por el pase.
 * En ambos casos, duplicado → reembolso en monedas; si no, se concede el objeto.
 */
function open(user, boxKey, { fromInventory = false } = {}) {
  const box = catalogService.boxesByKey()[boxKey];
  if (!box) throw new NotFoundError('Esa caja no existe.');

  const day = todayFor(user.timezone);

  return withTransaction(() => {
    if (fromInventory) {
      if (!lootboxRepository.takeOne(user.id, boxKey)) {
        throw new ConflictError('No tienes esa caja para abrir.');
      }
    } else if (!coinService.spend(user.id, box.price, 'lootbox_buy', boxKey, day)) {
      throw new ConflictError('Todavía no te alcanzan las monedas para esa caja.');
    }

    const item = roll(box);
    const duplicate = cosmeticRepository.owns(user.id, item.key);
    let refund = 0;

    if (duplicate) {
      refund = DUP_REFUND[item.rarity] || 0;
      coinService.credit(user.id, refund, 'lootbox_dup', day);
    } else {
      cosmeticsService.grant(user.id, item.key, 'lootbox');
    }

    return {
      boxKey,
      boxName: box.name,
      item: {
        key: item.key,
        name: item.name,
        rarity: item.rarity,
        rarityLabel: RARITIES[item.rarity].label,
        color: RARITIES[item.rarity].color,
      },
      duplicate,
      refund,
      balance: coinService.balance(user.id),
    };
  });
}

/**
 * Compra una caja SIN abrirla: cobra las monedas y la deja en el inventario para
 * abrirla luego (con su animación). Transaccional, como la compra que sí abre.
 */
function buyToInventory(user, boxKey) {
  const box = catalogService.boxesByKey()[boxKey];
  if (!box) throw new NotFoundError('Esa caja no existe.');

  const day = todayFor(user.timezone);

  return withTransaction(() => {
    if (!coinService.spend(user.id, box.price, 'lootbox_buy', boxKey, day)) {
      throw new ConflictError('Todavía no te alcanzan las monedas para esa caja.');
    }
    lootboxRepository.add(user.id, boxKey, 1);
    return {
      boxKey,
      boxName: box.name,
      owned: lootboxRepository.qtyOf(user.id, boxKey),
      balance: coinService.balance(user.id),
    };
  });
}

/** Añade cajas al inventario (recompensa del pase). Valida que la caja exista. */
function grantBox(userId, boxKey, n = 1) {
  if (!catalogService.boxesByKey()[boxKey]) throw new NotFoundError('Esa caja no existe.');
  lootboxRepository.add(userId, boxKey, n);
}

module.exports = { preview, open, buyToInventory, grantBox };
