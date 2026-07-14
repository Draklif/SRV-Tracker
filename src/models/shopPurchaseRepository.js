'use strict';

const db = require('../database/connection');

/**
 * Compras de la tienda: lo GASTADO. Va aparte del ledger de coin_events porque
 * un cargo no se parece en nada a un premio: la clave de una compra es
 * (usuario, objeto) para siempre, no (usuario, motivo, fuente, día).
 *
 * Ojo con el INSERT: aquí NO se usa INSERT OR IGNORE. Un premio ignorado es
 * correcto ("ya te lo di"); un CARGO ignorado es un objeto gratis. Si la compra
 * chocara con el índice único, tiene que reventar, no colarse en silencio. La
 * puerta de verdad es la comprobación de propiedad del servicio; este índice es
 * el último cortafuegos.
 */

const statements = {
  insert: db.prepare(`
    INSERT INTO shop_purchases (user_id, item_key, price, day)
    VALUES (@user_id, @item_key, @price, @day)
  `),
  listByUser: db.prepare(
    'SELECT item_key, price, day, created_at FROM shop_purchases WHERE user_id = ? ORDER BY created_at DESC'
  ),
  totalSpent: db.prepare(
    'SELECT COALESCE(SUM(price), 0) AS n FROM shop_purchases WHERE user_id = ?'
  ),
};

function insert(purchase) {
  statements.insert.run(purchase);
}

function listByUser(userId) {
  return statements.listByUser.all(userId);
}

/** Total gastado por el usuario (auditoría del saldo). */
function totalSpent(userId) {
  return statements.totalSpent.get(userId).n;
}

module.exports = { insert, listByUser, totalSpent };
