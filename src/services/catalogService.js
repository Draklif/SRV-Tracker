'use strict';

const { MANUAL } = require('../config/discounts');
const { ITEMS } = require('../config/cosmetics');
const { BOXES } = require('../config/lootboxes');
const adminDiscountRepository = require('../models/adminDiscountRepository');
const shopOverrideRepository = require('../models/shopOverrideRepository');
const dbLootboxRepository = require('../models/dbLootboxRepository');
const dbCosmeticRepository = require('../models/dbCosmeticRepository');

/**
 * Catálogo FUSIONADO: config del repo ∪ overlay de la base de datos.
 *
 * Los catálogos (cosméticos, cajas, descuentos) siguen viviendo como JS
 * congelado en src/config/*.js —versionados en el repo, revisados en PR—, pero
 * el panel de admin puede AÑADIR y AJUSTAR contenido en caliente guardándolo en
 * la BD. Este módulo es la única fuente que ve el resto de la app: fusiona ambas
 * capas y expone las mismas formas que ya consumen los services.
 *
 * Nunca se guarda CSS en la BD (la CSP es estricta): un cosmético de admin
 * guarda el NOMBRE de una clase escrita a mano en cosmetics.css, nunca estilo.
 *
 * Caché + invalidación: la fusión se memoiza por un contador `generation`. Cada
 * mutación de admin llama invalidate() (sube generation) y la siguiente lectura
 * reconstruye. Una instalación sin filas de overlay paga la fusión una vez y
 * luego lee de caché; los cambios de admin aparecen al instante.
 */

let generation = 0;
const cache = new Map(); // key → { gen, value }

/** Invalida la caché: la próxima lectura de cualquier vista se reconstruye. */
function invalidate() {
  generation += 1;
  cache.clear();
}

/** Memoiza el resultado de `build` bajo `key` hasta la próxima invalidación. */
function memo(key, build) {
  const hit = cache.get(key);
  if (hit && hit.gen === generation) return hit.value;
  const value = build();
  cache.set(key, { gen: generation, value });
  return value;
}

/**
 * Descuentos manuales vigentes = los de config (MANUAL) ++ los de la BD
 * (admin_discounts), normalizados a la forma que espera discountService:
 * { itemKey, percent, from, to } con from/to = 'YYYY-MM-DD' o null.
 */
function manualDiscounts() {
  return memo('manualDiscounts', () => {
    const fromConfig = MANUAL.map((d) => ({
      itemKey: d.itemKey,
      percent: d.percent,
      from: d.from || null,
      to: d.to || null,
    }));
    const fromDb = adminDiscountRepository.listAll().map((r) => ({
      itemKey: r.item_key,
      percent: r.percent,
      from: r.starts_on || null,
      to: r.ends_on || null,
    }));
    return [...fromConfig, ...fromDb];
  });
}

/** Fila de db_cosmetics → misma forma que un objeto de ITEMS. */
function mapDbCosmetic(row) {
  const item = {
    key: row.key,
    slot: row.slot,
    name: row.name,
    rarity: row.rarity,
    price: row.price,
    hidden: Boolean(row.hidden),
  };
  // Campos opcionales: se ponen solo si existen, para no ensuciar el objeto con
  // undefined y que se comporte igual que una entrada de config.
  if (row.css) item.css = row.css;
  if (row.glyph) item.glyph = row.glyph;
  if (row.text) item.text = row.text;
  if (row.gap) item.gap = true;
  if (row.inner_border) item.innerBorder = true;
  if (row.replace_border) item.replaceBorder = true;
  if (row.ink) item.ink = row.ink;
  return item;
}

/**
 * Los cosméticos fusionados: config (ITEMS) ++ los creados por admin
 * (db_cosmetics), con los overrides de precio/visibilidad de la tienda
 * (shop_item_overrides) aplicados ENCIMA. Los objetos de config son inmutables:
 * si un override los toca, se devuelve una copia, nunca se muta el original.
 */
function items() {
  return memo('items', () => {
    const merged = [...ITEMS, ...dbCosmeticRepository.listAll().map(mapDbCosmetic)];
    const overrides = shopOverrideRepository.map();
    return merged.map((it) => {
      const ov = overrides[it.key];
      if (!ov) return it;
      const next = { ...it };
      if (ov.price != null) next.price = ov.price;
      if (ov.hidden != null) next.hidden = Boolean(ov.hidden);
      return next;
    });
  });
}

function itemsByKey() {
  return memo('itemsByKey', () => Object.fromEntries(items().map((it) => [it.key, it])));
}

/** Fila de db_lootboxes → misma forma que una caja de BOXES (art + pool + desc). */
function mapDbBox(row) {
  return {
    key: row.key,
    name: row.name,
    price: row.price,
    art: row.art,
    desc: row.description || '',
    pool: row.pool, // ya parseado a array por el repo
    enabled: row.enabled,
  };
}

/**
 * Las cajas fusionadas: config (BOXES) ++ las creadas por admin (db_lootboxes).
 * Las de config no tienen `enabled` (se tratan como habilitadas); las de BD sí.
 */
function boxes() {
  return memo('boxes', () => [...BOXES, ...dbLootboxRepository.listAll().map(mapDbBox)]);
}

function boxesByKey() {
  return memo('boxesByKey', () => Object.fromEntries(boxes().map((b) => [b.key, b])));
}

module.exports = {
  invalidate,
  manualDiscounts,
  items,
  itemsByKey,
  boxes,
  boxesByKey,
};
