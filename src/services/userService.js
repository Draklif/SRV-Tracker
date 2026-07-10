'use strict';

const userRepository = require('../models/userRepository');
const password = require('../utils/password');
const { ValidationError, NotFoundError } = require('../utils/errors');

function getById(id) {
  return userRepository.findById(id);
}

/** Actualiza los datos de perfil (datos ya validados por profileSchema). */
function updateProfile(id, { displayName, bio, timezone, theme, accent }) {
  return userRepository.updateProfile(id, {
    displayName,
    bio: (bio && bio.trim()) || null,
    timezone,
    theme,
    accent,
  });
}

/** Cambia la contraseña verificando primero la actual. */
async function changePassword(id, currentPassword, newPassword) {
  const user = userRepository.findById(id);
  if (!user) throw new NotFoundError('Usuario no encontrado');

  const ok = await password.compare(currentPassword, user.password_hash);
  if (!ok) throw new ValidationError({ currentPassword: 'Contraseña actual incorrecta' });

  const passwordHash = await password.hash(newPassword);
  userRepository.updatePassword(id, passwordHash);
}

/** Asigna una nueva ruta de avatar. */
function setAvatar(id, avatarPath) {
  return userRepository.updateAvatar(id, avatarPath);
}

module.exports = { getById, updateProfile, changePassword, setAvatar };
