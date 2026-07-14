'use strict';

/**
 * ATAJO DE DESARROLLO — deja a un usuario listo para probar la tienda:
 * le quita todos los cosméticos (colección vacía, nada equipado) y le rellena
 * el saldo.
 *
 *   npm run dev:shop -- <username>          → 99.999 monedas
 *   npm run dev:shop -- <username> 500      → 500 monedas exactas
 *
 * NO es una semilla y NO se llama nunca desde el arranque. La regla del sistema
 * es que nada se regala: esto existe solo para poder recorrer el ciclo completo
 * (comprar → desbloquear → equipar) en local sin esperar semanas de hábitos.
 * Se planta en producción.
 *
 * Las monedas se ACUÑAN en coin_events, no se enchufan en users.coins a mano:
 * así el saldo sigue cuadrando con la invariante del sistema
 * (saldo == SUM(coin_events) - SUM(shop_purchases)) y la auditoría no chilla.
 */

const db = require('../connection');
const userRepository = require('../../models/userRepository');
const withTransaction = require('../withTransaction');
const { todayFor } = require('../../utils/date');

const DEFAULT_COINS = 99999;

const statements = {
  wipeCosmetics: db.prepare('DELETE FROM user_cosmetics WHERE user_id = ?'),
  wipePurchases: db.prepare('DELETE FROM shop_purchases WHERE user_id = ?'),
  unequip: db.prepare("UPDATE users SET cosmetics = '{}' WHERE id = ?"),
  // Cada concesión lleva su propio source_id para que el índice único no la
  // confunda con la anterior y la ignore: aquí sí queremos poder repetir.
  devGrants: db.prepare(
    "SELECT COUNT(*) AS n FROM coin_events WHERE user_id = ? AND reason = 'dev_grant'"
  ),
  mint: db.prepare(`
    INSERT INTO coin_events (user_id, amount, reason, source_type, source_id, day)
    VALUES (@user_id, @amount, 'dev_grant', 'dev', @source_id, @day)
  `),
  setCoins: db.prepare('UPDATE users SET coins = @coins WHERE id = @id'),
};

function devShop(username, coins = DEFAULT_COINS) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('dev:shop no se ejecuta en producción: nada se regala.');
  }

  const user = userRepository.findByUsername(username);
  if (!user) throw new Error(`No existe el usuario "${username}".`);

  return withTransaction(() => {
    statements.wipeCosmetics.run(user.id);
    statements.wipePurchases.run(user.id);
    statements.unequip.run(user.id);

    // Lo ya ganado de verdad se respeta; el resto se acuña como concesión de dev
    // hasta llegar al saldo pedido.
    const current = userRepository.findById(user.id).coins;
    const delta = coins - current;
    if (delta > 0) {
      const n = statements.devGrants.get(user.id).n;
      statements.mint.run({
        user_id: user.id,
        amount: delta,
        source_id: n + 1,
        day: todayFor(user.timezone),
      });
    }
    statements.setCoins.run({ id: user.id, coins });

    return { user, coins };
  });
}

if (require.main === module) {
  const username = process.argv[2];
  const amount = process.argv[3] ? Number(process.argv[3]) : DEFAULT_COINS;

  if (!username || !Number.isFinite(amount) || amount < 0) {
    console.error('Uso: npm run dev:shop -- <username> [monedas]');
    process.exit(1);
  }

  try {
    const { user } = devShop(username, amount);
    console.log(
      `[dev] @${user.username}: colección vaciada y saldo a ${amount} monedas. A comprar.`
    );
  } catch (err) {
    console.error(`[dev] ${err.message}`);
    process.exit(1);
  }
}

module.exports = { devShop };
