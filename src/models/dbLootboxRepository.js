'use strict';

const db = require('../database/connection');

/**
 * Cajas creadas por admin (tabla db_lootboxes). Único lugar con SQL de la tabla.
 * catalogService las fusiona con las de config; el admin las crea/deshabilita.
 * `pool` se guarda como JSON (array de claves); aquí se serializa/parsea.
 */

const statements = {
  all: db.prepare('SELECT * FROM db_lootboxes ORDER BY created_at DESC'),
  byKey: db.prepare('SELECT * FROM db_lootboxes WHERE key = ?'),
  insert: db.prepare(`
    INSERT INTO db_lootboxes (key, name, price, art, description, pool, enabled, created_by)
    VALUES (@key, @name, @price, @art, @description, @pool, @enabled, @created_by)
  `),
  setEnabled: db.prepare(
    "UPDATE db_lootboxes SET enabled = @enabled, updated_at = datetime('now') WHERE key = @key"
  ),
  deleteByKey: db.prepare('DELETE FROM db_lootboxes WHERE key = ?'),
};

function parse(row) {
  if (!row) return null;
  let pool = [];
  try {
    pool = JSON.parse(row.pool) || [];
  } catch (_) {
    pool = [];
  }
  return { ...row, pool, enabled: Boolean(row.enabled) };
}

function listAll() {
  return statements.all.all().map(parse);
}

function findByKey(key) {
  return parse(statements.byKey.get(key));
}

function create({ key, name, price, art, description = null, pool, enabled = true, createdBy = null }) {
  statements.insert.run({
    key,
    name,
    price,
    art,
    description,
    pool: JSON.stringify(pool || []),
    enabled: enabled ? 1 : 0,
    created_by: createdBy,
  });
  return findByKey(key);
}

/** Habilita/deshabilita una caja. Devuelve true si existía. */
function setEnabled(key, enabled) {
  return statements.setEnabled.run({ key, enabled: enabled ? 1 : 0 }).changes > 0;
}

/** Borra una caja de admin. Devuelve true si existía. */
function remove(key) {
  return statements.deleteByKey.run(key).changes > 0;
}

module.exports = { listAll, findByKey, create, setEnabled, remove };
