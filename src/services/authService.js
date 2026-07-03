'use strict';

const config = require('../config');
const userRepository = require('../models/userRepository');
const inviteRepository = require('../models/inviteRepository');
const withTransaction = require('../database/withTransaction');
const password = require('../utils/password');
const { ValidationError, AuthError } = require('../utils/errors');

function validateInvite(invite) {
  if (!invite) return 'Código de invitación no válido';
  if (invite.used_by) return 'Este código ya fue usado';
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return 'Este código expiró';
  return null;
}

/**
 * Registra un usuario nuevo consumiendo un código de invitación.
 * Recibe datos YA validados estructuralmente (ver registerSchema).
 */
async function register(input) {
  const username = input.username.trim();
  const displayName = (input.displayName && input.displayName.trim()) || username;
  const email = (input.email && input.email.trim()) || null;
  const code = input.inviteCode.trim();

  const invite = inviteRepository.findByCode(code);
  const inviteError = validateInvite(invite);
  if (inviteError) throw new ValidationError({ inviteCode: inviteError });

  if (userRepository.findByUsername(username)) {
    throw new ValidationError({ username: 'Ese usuario ya está en uso' });
  }

  const passwordHash = await password.hash(input.password);

  try {
    return withTransaction(() => {
      const user = userRepository.create({
        username,
        passwordHash,
        email,
        displayName,
        timezone: config.defaultTimezone,
      });
      inviteRepository.markUsed(invite.id, user.id);
      return user;
    });
  } catch (err) {
    // El único UNIQUE que no pre-validamos es el email.
    if (err.code && err.code.startsWith('SQLITE_CONSTRAINT')) {
      throw new ValidationError({ email: 'Ese email ya está registrado' });
    }
    throw err;
  }
}

/** Verifica credenciales y devuelve el usuario, o lanza AuthError. */
async function login(username, passwordPlain) {
  const user = userRepository.findByUsername(username.trim());

  // Comparamos siempre (con un hash ficticio si no hay usuario) para no filtrar
  // por tiempo si el usuario existe o no.
  const ok = await password.compare(passwordPlain, user ? user.password_hash : password.DUMMY_HASH);
  if (!user || !ok) throw new AuthError();

  userRepository.touchLastActive(user.id);
  return user;
}

module.exports = { register, login };
