'use strict';

const db = require('./connection');
const { runMigrations } = require('./migrate');
const { generateInviteCode } = require('../utils/inviteCode');

/**
 * Semilla de datos base. Idempotente: se puede correr varias veces sin duplicar.
 * Por ahora garantiza que exista al menos un código de invitación sin usar, para
 * que el primer amigo pueda registrarse. (Los logros se sembrarán en su milestone.)
 */

function seedInitialInvite() {
  const unused = db.prepare('SELECT code FROM invites WHERE used_by IS NULL LIMIT 1').get();
  if (unused) {
    console.log(`[seed] Ya existe una invitación sin usar: ${unused.code}`);
    return;
  }
  const code = generateInviteCode();
  db.prepare('INSERT INTO invites (code) VALUES (?)').run(code);
  console.log('[seed] Invitación inicial creada. Úsala para registrar la primera cuenta:');
  console.log(`\n    ${code}\n`);
}

function seed() {
  runMigrations();
  seedInitialInvite();
  require('./seeds/achievements').seedAchievements();
  console.log('[seed] Listo.');
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
