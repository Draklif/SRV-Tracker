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
  setNotifyEnabled: db.prepare(
    "UPDATE users SET notify_enabled = @enabled, updated_at = datetime('now') WHERE id = @id"
  ),
  updateNotifyPrefs: db.prepare(`
    UPDATE users
    SET notify_reminder_time = @reminderTime, notify_streak_guard = @streakGuard,
        updated_at = datetime('now')
    WHERE id = @id
  `),
  notifiable: db.prepare('SELECT * FROM users WHERE notify_enabled = 1'),
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

/** Activa/desactiva el opt-in general de notificaciones del usuario. */
function setNotifyEnabled(id, enabled) {
  statements.setNotifyEnabled.run({ id, enabled: enabled ? 1 : 0 });
}

/** Guarda las preferencias de recordatorio (hora y aviso de racha). */
function updateNotifyPrefs(id, { reminderTime, streakGuard }) {
  statements.updateNotifyPrefs.run({ id, reminderTime, streakGuard: streakGuard ? 1 : 0 });
  return statements.byId.get(id);
}

/** Usuarios con el opt-in de notificaciones activo (para el scheduler). */
function listNotifiable() {
  return statements.notifiable.all();
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
  setNotifyEnabled,
  updateNotifyPrefs,
  listNotifiable,
};
