'use strict';

/**
 * ATAJO DE DESARROLLO — concede TODO el catálogo de cosméticos a un usuario.
 *
 *   npm run grant:cosmetics -- <username>
 *
 * NO es una semilla y NO se llama nunca desde el arranque (a diferencia de
 * seeds/achievements.js). La regla del sistema de cosméticos es que nada se
 * regala: todo se desbloquea. Esto existe solo para poder ver los marcos en
 * local sin haber montado aún la tienda, así que se ejecuta a mano y se planta
 * en producción.
 */

const cosmeticRepository = require('../../models/cosmeticRepository');
const userRepository = require('../../models/userRepository');
const { ITEMS } = require('../../config/cosmetics');

function grantAllCosmetics(username) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('grant:cosmetics no se ejecuta en producción: nada se regala.');
  }

  const user = userRepository.findByUsername(username);
  if (!user) throw new Error(`No existe el usuario "${username}".`);

  let added = 0;
  for (const item of ITEMS) {
    if (cosmeticRepository.grant(user.id, item.key, 'grant')) added += 1;
  }
  return { user, added, total: ITEMS.length };
}

if (require.main === module) {
  const username = process.argv[2];
  if (!username) {
    console.error('Uso: npm run grant:cosmetics -- <username>');
    process.exit(1);
  }

  try {
    const { user, added, total } = grantAllCosmetics(username);
    console.log(
      `[dev] ${added} objeto(s) nuevo(s) para @${user.username} (${total} en el catálogo).`
    );
  } catch (err) {
    console.error(`[dev] ${err.message}`);
    process.exit(1);
  }
}

module.exports = { grantAllCosmetics };
