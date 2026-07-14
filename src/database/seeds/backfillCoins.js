'use strict';

/**
 * BACKFILL DE MONEDAS — reparte las monedas que los usuarios YA se habían ganado.
 *
 *   npm run backfill:coins            → todos
 *   npm run backfill:coins -- <user>  → uno solo
 *
 * Replica el ledger de XP a través de COIN_RULES, escribiendo exactamente las
 * MISMAS tuplas (usuario, motivo, fuente, día) que escribiría el subscriber en
 * vivo. Por eso el índice único lo vuelve idempotente por construcción:
 * ejecutarlo dos veces no da una moneda de más, y ejecutarlo con la app en marcha
 * tampoco.
 *
 * A DIFERENCIA DE grant:cosmetics, esto SÍ se ejecuta en producción: no regala
 * nada, paga lo ya trabajado. Se corre una vez tras aplicar 0017_coins.sql.
 */

const coinService = require('../../services/coinService');
const coinEventRepository = require('../../models/coinEventRepository');
const userRepository = require('../../models/userRepository');
const config = require('../../config');

function backfillCoins(username) {
  let userIds;
  if (username) {
    const user = userRepository.findByUsername(username);
    if (!user) throw new Error(`No existe el usuario "${username}".`);
    userIds = [user.id];
  } else {
    // Solo quien tiene XP puede tener monedas atrasadas.
    userIds = coinEventRepository.usersWithXp();
  }

  const results = userIds
    .map((id) => userRepository.findById(id))
    .filter(Boolean)
    .map((user) => ({
      username: user.username,
      minted: coinService.mintAll(user.id), // 0 si ya estaba al día
      balance: coinService.balance(user.id),
    }));

  return { results, skipped: coinEventRepository.countSkippable() };
}

if (require.main === module) {
  try {
    const { results, skipped } = backfillCoins(process.argv[2]);

    console.log(`[monedas] ritmo COIN_RATE = ${config.economy.coinRate}`);
    for (const r of results) {
      console.log(`[monedas] @${r.username}: +${r.minted} (saldo ${r.balance})`);
    }
    if (!results.length) console.log('[monedas] no hay usuarios con XP que pagar.');
    if (skipped > 0) {
      // Filas anteriores a 0002_xp_day, sin día. No se pueden acuñar sin duplicarlas
      // en cada pasada (en SQLite dos NULL son distintos dentro de un índice único).
      console.log(`[monedas] ${skipped} premio(s) de XP sin día: no se acuñan (filas legado).`);
    }
  } catch (err) {
    console.error(`[monedas] ${err.message}`);
    process.exit(1);
  }
}

module.exports = { backfillCoins };
