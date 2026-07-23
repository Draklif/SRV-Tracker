'use strict';

const db = require('../database/connection');

/**
 * Acceso a datos de los descuentos manuales de admin (tabla admin_discounts).
 * Único lugar con SQL de la tabla. discountService los lee (fusionados con la
 * config MANUAL vía catalogService); el panel de admin los crea y borra.
 */

const statements = {
  all: db.prepare('SELECT * FROM admin_discounts ORDER BY created_at DESC'),
  insert: db.prepare(`
    INSERT INTO admin_discounts (item_key, percent, starts_on, ends_on, created_by)
    VALUES (@item_key, @percent, @starts_on, @ends_on, @created_by)
  `),
  byId: db.prepare('SELECT * FROM admin_discounts WHERE id = ?'),
  deleteById: db.prepare('DELETE FROM admin_discounts WHERE id = ?'),
};

/** Todos los descuentos manuales, del más nuevo al más viejo. */
function listAll() {
  return statements.all.all();
}

/** Crea un descuento manual. Devuelve la fila creada. */
function create({ itemKey, percent, startsOn = null, endsOn = null, createdBy = null }) {
  const info = statements.insert.run({
    item_key: itemKey,
    percent,
    starts_on: startsOn,
    ends_on: endsOn,
    created_by: createdBy,
  });
  return statements.byId.get(info.lastInsertRowid);
}

function findById(id) {
  return statements.byId.get(id);
}

/** Borra un descuento manual. Devuelve true si existía. */
function remove(id) {
  return statements.deleteById.run(id).changes > 0;
}

module.exports = { listAll, create, findById, remove };
