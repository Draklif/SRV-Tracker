'use strict';

const db = require('../database/connection');

/**
 * Acceso a datos de usuarios. Único lugar con SQL de la tabla `users`.
 * Devuelve filas planas; la lógica de negocio vive en los services.
 */

const statements = {
  insert: db.prepare(`
    INSERT INTO users (username, password_hash, email, display_name, timezone)
    VALUES (@username, @passwordHash, @email, @displayName, @timezone)
  `),
  byId: db.prepare('SELECT * FROM users WHERE id = ?'),
  byUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  updateProfile: db.prepare(`
    UPDATE users
    SET display_name = @displayName, bio = @bio, timezone = @timezone,
        theme = @theme, accent = @accent, updated_at = datetime('now')
    WHERE id = @id
  `),
  updatePassword: db.prepare(`
    UPDATE users SET password_hash = @passwordHash, updated_at = datetime('now') WHERE id = @id
  `),
  updateAvatar: db.prepare(`
    UPDATE users SET avatar_path = @avatarPath, updated_at = datetime('now') WHERE id = @id
  `),
  touchActive: db.prepare("UPDATE users SET last_active_at = datetime('now') WHERE id = ?"),
  addXp: db.prepare('UPDATE users SET xp = xp + @amount WHERE id = @id'),
};

function create({ username, passwordHash, email, displayName, timezone }) {
  const info = statements.insert.run({ username, passwordHash, email, displayName, timezone });
  return statements.byId.get(info.lastInsertRowid);
}

function findById(id) {
  return statements.byId.get(id);
}

function findByUsername(username) {
  return statements.byUsername.get(username);
}

function updateProfile(id, { displayName, bio, timezone, theme, accent }) {
  statements.updateProfile.run({ id, displayName, bio, timezone, theme, accent });
  return statements.byId.get(id);
}

function updatePassword(id, passwordHash) {
  statements.updatePassword.run({ id, passwordHash });
}

function updateAvatar(id, avatarPath) {
  statements.updateAvatar.run({ id, avatarPath });
  return statements.byId.get(id);
}

function touchLastActive(id) {
  statements.touchActive.run(id);
}

/** Suma XP al contador denormalizado (la verdad vive en xp_events). */
function addXp(id, amount) {
  statements.addXp.run({ id, amount });
}

module.exports = {
  create,
  findById,
  findByUsername,
  updateProfile,
  updatePassword,
  updateAvatar,
  touchLastActive,
  addXp,
};
