'use strict';

const db = require('../database/connection');

/**
 * Acceso a datos de cosméticos. Único lugar con SQL de `user_cosmetics` y del
 * blob `users.cosmetics`. El catálogo NO está en la BD (ver config/cosmetics.js):
 * aquí solo se mueven claves.
 */

const statements = {
  // Idempotente por el índice único (user_id, item_key): conceder dos veces el
  // mismo objeto no duplica ni falla.
  grant: db.prepare(`
    INSERT OR IGNORE INTO user_cosmetics (user_id, item_key, source)
    VALUES (@user_id, @item_key, @source)
  `),
  ownedKeys: db.prepare('SELECT item_key FROM user_cosmetics WHERE user_id = ?'),
  owns: db.prepare(
    'SELECT 1 FROM user_cosmetics WHERE user_id = @user_id AND item_key = @item_key LIMIT 1'
  ),
  countByUser: db.prepare('SELECT COUNT(*) AS n FROM user_cosmetics WHERE user_id = ?'),
  setEquipped: db.prepare(
    "UPDATE users SET cosmetics = @cosmetics, updated_at = datetime('now') WHERE id = @id"
  ),
  equippedOf: db.prepare('SELECT cosmetics FROM users WHERE id = ?'),
};

/** Concede un objeto. Devuelve true si es nuevo, false si ya lo tenía. */
function grant(userId, itemKey, source = 'grant') {
  const info = statements.grant.run({ user_id: userId, item_key: itemKey, source });
  return info.changes > 0;
}

/** Claves de los objetos que posee el usuario. */
function ownedKeys(userId) {
  return statements.ownedKeys.all(userId).map((r) => r.item_key);
}

function owns(userId, itemKey) {
  return Boolean(statements.owns.get({ user_id: userId, item_key: itemKey }));
}

function countByUser(userId) {
  return statements.countByUser.get(userId).n;
}

/** Blob JSON crudo de lo que el usuario lleva puesto. */
function equippedRaw(userId) {
  const row = statements.equippedOf.get(userId);
  return (row && row.cosmetics) || '{}';
}

/** Guarda el blob de equipado (el service ya lo validó). */
function setEquipped(userId, cosmeticsJson) {
  statements.setEquipped.run({ id: userId, cosmetics: cosmeticsJson });
}

module.exports = { grant, ownedKeys, owns, countByUser, equippedRaw, setEquipped };
