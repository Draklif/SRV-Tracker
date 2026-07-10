'use strict';

const db = require('../database/connection');

/**
 * Acceso a datos de las suscripciones push (Web Push) de cada usuario.
 * Único lugar con SQL de la tabla `push_subscriptions`.
 */

const statements = {
  upsert: db.prepare(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
    VALUES (@userId, @endpoint, @p256dh, @auth, @userAgent)
    ON CONFLICT(endpoint) DO UPDATE SET
      user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent = excluded.user_agent
  `),
  byUser: db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ? ORDER BY created_at'),
  deleteByEndpoint: db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?'),
  deleteByUserEndpoint: db.prepare(
    'DELETE FROM push_subscriptions WHERE user_id = @userId AND endpoint = @endpoint'
  ),
  deleteByUser: db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?'),
  countByUser: db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?'),
};

/** Crea o actualiza una suscripción (idempotente por endpoint). */
function save({ userId, endpoint, p256dh, auth, userAgent }) {
  statements.upsert.run({ userId, endpoint, p256dh, auth, userAgent: userAgent || null });
}

function findByUser(userId) {
  return statements.byUser.all(userId);
}

/** Borra una suscripción por su endpoint (p. ej. cuando el push devuelve 404/410). */
function deleteByEndpoint(endpoint) {
  statements.deleteByEndpoint.run(endpoint);
}

/** Borra una suscripción concreta de un usuario (desactivar en un dispositivo). */
function deleteForUser(userId, endpoint) {
  statements.deleteByUserEndpoint.run({ userId, endpoint });
}

/** Borra todas las suscripciones de un usuario. */
function deleteAllForUser(userId) {
  statements.deleteByUser.run(userId);
}

function countForUser(userId) {
  return statements.countByUser.get(userId).n;
}

module.exports = {
  save,
  findByUser,
  deleteByEndpoint,
  deleteForUser,
  deleteAllForUser,
  countForUser,
};
