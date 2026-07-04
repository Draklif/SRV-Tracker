'use strict';

const db = require('../database/connection');

/** Acceso a datos de logros y desbloqueos por usuario. */

const statements = {
  listActive: db.prepare('SELECT * FROM achievements WHERE is_active = 1 ORDER BY id'),
  unlockedIds: db.prepare(`
    SELECT achievement_id FROM user_achievements
    WHERE user_id = ? AND unlocked_at IS NOT NULL
  `),
  unlock: db.prepare(`
    INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at)
    VALUES (@user_id, @achievement_id, datetime('now'))
  `),
  listForUser: db.prepare(`
    SELECT a.*, ua.unlocked_at
    FROM achievements a
    LEFT JOIN user_achievements ua
      ON ua.achievement_id = a.id AND ua.user_id = ?
    WHERE a.is_active = 1
    ORDER BY (ua.unlocked_at IS NULL), a.id
  `),
};

function listActive() {
  return statements.listActive.all();
}

function unlockedIds(userId) {
  return new Set(statements.unlockedIds.all(userId).map((r) => r.achievement_id));
}

/** Desbloquea un logro. Devuelve true si es un desbloqueo nuevo. */
function unlock(userId, achievementId) {
  return statements.unlock.run({ user_id: userId, achievement_id: achievementId }).changes > 0;
}

/** Todos los logros activos con su estado (unlocked_at) para un usuario. */
function listForUser(userId) {
  return statements.listForUser.all(userId);
}

module.exports = { listActive, unlockedIds, unlock, listForUser };
