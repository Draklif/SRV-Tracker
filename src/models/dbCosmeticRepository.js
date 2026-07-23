'use strict';

const db = require('../database/connection');

/**
 * Cosméticos creados por admin (tabla db_cosmetics). Único lugar con SQL de la
 * tabla. catalogService los fusiona con los de config; el admin los crea, oculta
 * o borra. Nunca se guarda CSS: `css` es solo el NOMBRE de una clase del repo.
 */

const statements = {
  all: db.prepare('SELECT * FROM db_cosmetics ORDER BY created_at DESC'),
  byKey: db.prepare('SELECT * FROM db_cosmetics WHERE key = ?'),
  insert: db.prepare(`
    INSERT INTO db_cosmetics
      (key, slot, name, rarity, price, hidden, css, glyph, text, gap, inner_border, replace_border, ink, created_by)
    VALUES
      (@key, @slot, @name, @rarity, @price, @hidden, @css, @glyph, @text, @gap, @inner_border, @replace_border, @ink, @created_by)
  `),
  setHidden: db.prepare('UPDATE db_cosmetics SET hidden = @hidden WHERE key = @key'),
  deleteByKey: db.prepare('DELETE FROM db_cosmetics WHERE key = ?'),
};

function listAll() {
  return statements.all.all();
}

function findByKey(key) {
  return statements.byKey.get(key);
}

function create(row) {
  statements.insert.run({
    key: row.key,
    slot: row.slot,
    name: row.name,
    rarity: row.rarity,
    price: row.price || 0,
    hidden: row.hidden ? 1 : 0,
    css: row.css || null,
    glyph: row.glyph || null,
    text: row.text || null,
    gap: row.gap ? 1 : 0,
    inner_border: row.innerBorder ? 1 : 0,
    replace_border: row.replaceBorder ? 1 : 0,
    ink: row.ink || null,
    created_by: row.createdBy || null,
  });
  return statements.byKey.get(row.key);
}

/** Oculta/muestra un cosmético de admin. Devuelve true si existía. */
function setHidden(key, hidden) {
  return statements.setHidden.run({ key, hidden: hidden ? 1 : 0 }).changes > 0;
}

/** Borra un cosmético de admin. Devuelve true si existía. */
function remove(key) {
  return statements.deleteByKey.run(key).changes > 0;
}

module.exports = { listAll, findByKey, create, setHidden, remove };
