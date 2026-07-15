'use strict';

const db = require('../database/connection');

/**
 * Ledger de gastos de monedas que NO son la compra de un cosmético del catálogo
 * (comprar una caja, desbloquear el premium del pase). Existe para que la
 * invariante del saldo siga cuadrando:
 *   saldo == SUM(coin_events) - SUM(shop_purchases) - SUM(coin_spends)
 */

const statements = {
  insert: db.prepare(`
    INSERT INTO coin_spends (user_id, amount, reason, ref, day)
    VALUES (@user_id, @amount, @reason, @ref, @day)
  `),
  totalByUser: db.prepare('SELECT COALESCE(SUM(amount), 0) AS n FROM coin_spends WHERE user_id = ?'),
};

/** Registra un gasto (debe ir dentro de la misma transacción que lo descuenta). */
function insert(spend) {
  statements.insert.run(spend);
}

/** Total gastado por el usuario fuera de la tienda (auditoría del saldo). */
function totalByUser(userId) {
  return statements.totalByUser.get(userId).n;
}

module.exports = { insert, totalByUser };
