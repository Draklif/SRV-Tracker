'use strict';

const crypto = require('crypto');

/**
 * Genera un código de invitación corto y legible: 4 grupos de 4 caracteres,
 * sin caracteres ambiguos (0/O, 1/I). Fuente única compartida por la semilla
 * inicial y las invitaciones que generan los propios usuarios.
 */
function generateInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(16);
  let code = '';
  for (let i = 0; i < 16; i += 1) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

module.exports = { generateInviteCode };
