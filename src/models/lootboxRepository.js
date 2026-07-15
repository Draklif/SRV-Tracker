'use strict';

const db = require('../database/connection');

/**
 * Inventario de cajas sin abrir (tabla user_lootboxes: un contador por tipo).
 * Solo lo tocan las cajas ganadas por el pase (esperan aquí) y su apertura desde
 * el inventario; comprar en la tienda no pasa por aquí (se abre en el acto).
 */

const statements = {
  add: db.prepare(`
    INSERT INTO user_lootboxes (user_id, box_key, qty)
    VALUES (@user_id, @box_key, @qty)
    ON CONFLICT(user_id, box_key) DO UPDATE SET qty = qty + excluded.qty
  `),
  // Descuenta UNA caja solo si hay stock: la guarda `qty > 0` es lo que impide
  // abrir una caja que no tienes aunque lleguen dos aperturas a la vez.
  takeOne: db.prepare(
    'UPDATE user_lootboxes SET qty = qty - 1 WHERE user_id = ? AND box_key = ? AND qty > 0'
  ),
  qtyOf: db.prepare('SELECT qty FROM user_lootboxes WHERE user_id = ? AND box_key = ?'),
  listFor: db.prepare(
    'SELECT box_key, qty FROM user_lootboxes WHERE user_id = ? AND qty > 0'
  ),
};

/** Añade `n` cajas de un tipo al inventario del usuario. */
function add(userId, boxKey, n = 1) {
  statements.add.run({ user_id: userId, box_key: boxKey, qty: n });
}

/** Descuenta una caja. Devuelve true si había stock (y se descontó). */
function takeOne(userId, boxKey) {
  return statements.takeOne.run(userId, boxKey).changes > 0;
}

/** Cuántas cajas de ese tipo tiene el usuario sin abrir. */
function qtyOf(userId, boxKey) {
  const row = statements.qtyOf.get(userId, boxKey);
  return row ? row.qty : 0;
}

/** Mapa box_key → qty de las cajas sin abrir del usuario. */
function countsFor(userId) {
  const out = {};
  for (const row of statements.listFor.all(userId)) out[row.box_key] = row.qty;
  return out;
}

module.exports = { add, takeOne, qtyOf, countsFor };
