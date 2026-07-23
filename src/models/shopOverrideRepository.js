'use strict';

const db = require('../database/connection');

/**
 * Overrides de tienda por objeto (tabla shop_item_overrides). Único lugar con
 * SQL de la tabla. catalogService los aplica encima del catálogo; el admin los
 * crea/quita. price/hidden NULL = "sin override, usa lo de config".
 */

const statements = {
  all: db.prepare('SELECT * FROM shop_item_overrides'),
  upsert: db.prepare(`
    INSERT INTO shop_item_overrides (item_key, price, hidden, updated_by, updated_at)
    VALUES (@item_key, @price, @hidden, @updated_by, datetime('now'))
    ON CONFLICT(item_key) DO UPDATE SET
      price = excluded.price,
      hidden = excluded.hidden,
      updated_by = excluded.updated_by,
      updated_at = datetime('now')
  `),
  deleteByKey: db.prepare('DELETE FROM shop_item_overrides WHERE item_key = ?'),
};

/** Todas las filas de override. */
function listAll() {
  return statements.all.all();
}

/** Mapa item_key → { price, hidden } (para fusionar en catalogService). */
function map() {
  const out = {};
  for (const row of statements.all.all()) {
    out[row.item_key] = { price: row.price, hidden: row.hidden };
  }
  return out;
}

/**
 * Fija (o actualiza) el override de un objeto. `price`/`hidden` null = sin ese
 * override. Devuelve la clave.
 */
function upsert({ itemKey, price = null, hidden = null, updatedBy = null }) {
  statements.upsert.run({
    item_key: itemKey,
    price,
    hidden: hidden == null ? null : hidden ? 1 : 0,
    updated_by: updatedBy,
  });
  return itemKey;
}

/** Quita el override de un objeto (vuelve a lo de config). true si existía. */
function remove(itemKey) {
  return statements.deleteByKey.run(itemKey).changes > 0;
}

module.exports = { listAll, map, upsert, remove };
