'use strict';

/**
 * ATAJO DE DESARROLLO — deja a un usuario listo para probar el pase y las cajas:
 * le mete XP DENTRO de la temporada activa (para que el pase tenga niveles),
 * un par de cajas sin abrir en el inventario y monedas de sobra.
 *
 *   npm run dev:pass -- <username>          → ~900 XP de pase, 3 cajas, +5000 monedas
 *   npm run dev:pass -- <username> 2000     → 2000 XP de pase (sube más niveles)
 *
 * NO es una semilla y NO se llama desde el arranque. Como dev:shop, existe solo
 * para recorrer el ciclo (subir pase → reclamar → abrir caja) en local sin
 * esperar semanas. No wipea nada: así se pueden probar duplicados de caja.
 */

const userRepository = require('../../models/userRepository');
const xpEventRepository = require('../../models/xpEventRepository');
const lootboxRepository = require('../../models/lootboxRepository');
const coinService = require('../../services/coinService');
const withTransaction = require('../withTransaction');
const { todayFor } = require('../../utils/date');
const { activeSeason } = require('../../config/seasons');

const DEFAULT_XP = 900;
const DEV_COINS = 5000;

function devPass(username, xp = DEFAULT_XP) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('dev:pass no se ejecuta en producción: nada se regala.');
  }

  const user = userRepository.findByUsername(username);
  if (!user) throw new Error(`No existe el usuario "${username}".`);

  const day = todayFor(user.timezone);
  const season = activeSeason(day);
  if (!season) throw new Error(`No hay temporada activa el ${day} (revisa src/config/seasons.js).`);

  return withTransaction(() => {
    // XP de pase: una fila fechada dentro de la temporada. reason 'dev_pass' no
    // acuña monedas (no es un premio conocido), así que no descuadra el saldo.
    const n = xpEventRepository.countByReason(user.id, 'dev_pass');
    xpEventRepository.insertIfNew({
      user_id: user.id,
      amount: xp,
      reason: 'dev_pass',
      source_type: 'dev',
      source_id: n + 1,
      day,
    });

    // Cajas sin abrir para probar la apertura desde inventario.
    lootboxRepository.add(user.id, 'caja-comun', 2);
    lootboxRepository.add(user.id, 'caja-rara', 1);

    // Monedas para comprar cajas y el premium.
    coinService.credit(user.id, DEV_COINS, 'dev_grant', day);

    return { user, xp, season };
  });
}

if (require.main === module) {
  const username = process.argv[2];
  const xp = process.argv[3] ? Number(process.argv[3]) : DEFAULT_XP;

  if (!username || !Number.isFinite(xp) || xp < 0) {
    console.error('Uso: npm run dev:pass -- <username> [xp]');
    process.exit(1);
  }

  try {
    const { user, season } = devPass(username, xp);
    console.log(
      `[dev] @${user.username}: ${xp} XP en "${season.name}", 3 cajas y +${DEV_COINS} monedas. A probar.`
    );
  } catch (err) {
    console.error(`[dev] ${err.message}`);
    process.exit(1);
  }
}

module.exports = { devPass };
