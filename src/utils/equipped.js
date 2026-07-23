'use strict';

const { ITEMS_BY_KEY, SLOT_KEYS } = require('../config/cosmetics');

/**
 * Resolución de lo que alguien lleva puesto: blob `users.cosmetics` → objetos
 * del catálogo. Puro (no toca la BD) por dos razones: se llama una vez por cada
 * avatar que se pinta —feed, listas, nav— y así se puede probar sin base de
 * datos, como utils/level.js.
 */

/** Parsea el blob. Ante cualquier basura devuelve {} en vez de reventar. */
function parseEquipped(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

/**
 * Fila de usuario → { avatar_frame: {…item}, title: {…item} }. Los huecos vacíos
 * no aparecen. Una clave que ya no exista en el catálogo (o que esté en el hueco
 * equivocado) se ignora: así se puede retirar un objeto del repo sin romper a
 * quien lo llevara puesto.
 *
 * Sigue siendo PURA: el catálogo se inyecta. Por defecto usa el de config (para
 * los tests y cualquier llamada suelta); el camino de render pasa el catálogo
 * FUSIONADO (catalogService.itemsByKey) para que también se pinten los cosméticos
 * creados por admin. Ver cosmeticsService.resolve.
 */
function resolveEquipped(row, itemsByKey = ITEMS_BY_KEY) {
  const equipped = parseEquipped(row && row.cosmetics);
  const out = {};
  for (const slot of SLOT_KEYS) {
    const item = itemsByKey[equipped[slot]];
    if (item && item.slot === slot) out[slot] = item;
  }
  return out;
}

module.exports = { parseEquipped, resolveEquipped };
