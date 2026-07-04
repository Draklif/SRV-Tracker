'use strict';

const crypto = require('crypto');
const db = require('./connection');
const { runMigrations } = require('./migrate');

/**
 * Semilla de datos base. Idempotente: se puede correr varias veces sin duplicar.
 * Por ahora garantiza que exista al menos un código de invitación sin usar, para
 * que el primer amigo pueda registrarse. (Los logros se sembrarán en su milestone.)
 */

function generateInviteCode() {
  // Código corto y legible: 4 grupos de 4 caracteres, sin ambigüedades (0/O, 1/I).
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(16);
  let code = '';
  for (let i = 0; i < 16; i += 1) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

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

module.exports = { seed, generateInviteCode };
