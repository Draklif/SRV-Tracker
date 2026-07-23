'use strict';

/**
 * Promueve (o degrada) a un usuario a administrador. Es la ÚNICA vía para crear
 * el primer admin: el registro siempre da rol 'member' y ninguna migración sabe
 * a quién promover ni si ya hay usuarios cuando corre.
 *
 *   npm run make:admin -- <username>          → lo hace admin
 *   npm run make:admin -- <username> member   → lo devuelve a member
 *
 * Idempotente: fijar el rol que ya tiene no cambia nada.
 */

const userRepository = require('../../models/userRepository');
const { ROLES } = require('../../config/constants');

function makeAdmin(username, role = ROLES.ADMIN) {
  if (role !== ROLES.ADMIN && role !== ROLES.MEMBER) {
    throw new Error(`Rol inválido "${role}". Usa 'admin' o 'member'.`);
  }

  const user = userRepository.findByUsername(username);
  if (!user) throw new Error(`No existe el usuario "${username}".`);

  userRepository.setRole(user.id, role);
  return { user, role };
}

if (require.main === module) {
  const username = process.argv[2];
  const role = process.argv[3] || ROLES.ADMIN;

  if (!username) {
    console.error('Uso: npm run make:admin -- <username> [admin|member]');
    process.exit(1);
  }

  try {
    const { user } = makeAdmin(username, role);
    console.log(`[admin] @${user.username} ahora tiene rol "${role}".`);
  } catch (err) {
    console.error(`[admin] ${err.message}`);
    process.exit(1);
  }
}

module.exports = { makeAdmin };
