'use strict';

const { ITEMS } = require('../config/cosmetics');
const { WEEKLY } = require('../config/discounts');
const catalogService = require('./catalogService');
const { weekKey } = require('../utils/isoWeek');

/**
 * Descuentos de la tienda. Todo se resuelve aquí, en el servidor: shopService
 * pregunta el precio efectivo y cobra ESE, nunca uno que venga del cliente.
 *
 * Dos capas (ver src/config/discounts.js): las rebajas semanales automáticas
 * (elegidas por un azar sembrado por el número de semana, iguales para todos) y
 * las manuales de config (con prioridad sobre la semanal del mismo objeto).
 */

/** PRNG determinista (mulberry32): misma semilla → misma secuencia. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Las rebajas semanales de una semana no cambian: se calculan una vez por
// número de semana y se recuerdan (la config es estática).
let weeklyCache = { seed: null, picks: null };

/**
 * Objetos en oferta esta semana → Map(itemKey → percent). Elige `WEEKLY.count`
 * objetos vendibles (no ocultos, con precio) barajándolos de forma determinista
 * por el número de semana, y a cada uno un porcentaje de `WEEKLY.percents`.
 */
function weeklyPicks(day) {
  const seed = weekKey(day);
  if (weeklyCache.seed === seed) return weeklyCache.picks;

  const rand = mulberry32(seed + 0x9e3779b9);
  const eligible = ITEMS.filter((it) => !it.hidden && it.price > 0).map((it) => it.key);

  // Fisher–Yates sembrado: baraja y toma los primeros count.
  for (let i = eligible.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }

  const picks = new Map();
  const n = Math.min(WEEKLY.count, eligible.length);
  for (let i = 0; i < n; i += 1) {
    const percent = WEEKLY.percents[Math.floor(rand() * WEEKLY.percents.length)];
    picks.set(eligible[i], percent);
  }

  weeklyCache = { seed, picks };
  return picks;
}

/**
 * Rebaja manual vigente de un objeto (respeta la ventana from/to), o null.
 * Las rebajas manuales son las de config MÁS las que el admin haya puesto en la
 * BD, fusionadas por catalogService (la config sigue siendo fuente de verdad,
 * la BD la amplía).
 */
function manualFor(itemKey, day) {
  let hit = null;
  for (const d of catalogService.manualDiscounts()) {
    if (d.itemKey !== itemKey) continue;
    if (d.from && day < d.from) continue;
    if (d.to && day > d.to) continue;
    hit = d; // la última vigente gana
  }
  return hit ? hit.percent : null;
}

/**
 * El descuento vigente de un objeto → { percent, source } o null. La manual
 * manda sobre la semanal. Los objetos ocultos nunca llevan descuento (no se
 * venden).
 */
function discountFor(itemKey, day) {
  // Catálogo FUSIONADO: así una rebaja manual también vale para un cosmético
  // creado por admin (no solo para los de config).
  const item = catalogService.itemsByKey()[itemKey];
  if (!item || item.hidden || !(item.price > 0)) return null;

  const manual = manualFor(itemKey, day);
  if (manual != null) return { percent: manual, source: 'manual' };

  const weekly = weeklyPicks(day).get(itemKey);
  if (weekly != null) return { percent: weekly, source: 'weekly' };

  return null;
}

/** Precio a cobrar hoy por un objeto, ya con el descuento aplicado. */
function effectivePrice(item, day) {
  const d = discountFor(item.key, day);
  if (!d) return item.price;
  return Math.max(0, Math.round((item.price * (100 - d.percent)) / 100));
}

module.exports = { weeklyPicks, discountFor, effectivePrice };
