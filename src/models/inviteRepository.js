'use strict';

const db = require('../database/connection');

/**
 * Acceso a datos de invitaciones (registro cerrado).
 */

const statements = {
  insert: db.prepare('INSERT INTO invites (code, created_by, expires_at) VALUES (@code, @createdBy, @expiresAt)'),
  byCode: db.prepare('SELECT * FROM invites WHERE code = ?'),
  markUsed: db.prepare("UPDATE invites SET used_by = @userId, used_at = datetime('now') WHERE id = @id"),
  listActive: db.prepare('SELECT * FROM invites WHERE used_by IS NULL ORDER BY created_at DESC'),
  // Orden por id (no created_at): dos códigos creados en el mismo segundo
  // empatarían en created_at y podríamos devolver el viejo ya expirado.
  latestUnusedByUser: db.prepare(
    'SELECT * FROM invites WHERE created_by = ? AND used_by IS NULL ORDER BY id DESC LIMIT 1'
  ),
  expireUnusedByUser: db.prepare(
    'UPDATE invites SET expires_at = @expiresAt WHERE created_by = @userId AND used_by IS NULL'
  ),
};

function create({ code, createdBy = null, expiresAt = null }) {
  const info = statements.insert.run({ code, createdBy, expiresAt });
  return statements.byCode.get(code) && info.lastInsertRowid;
}

function findByCode(code) {
  return statements.byCode.get(code);
}

function markUsed(id, userId) {
  statements.markUsed.run({ id, userId });
}

function listActive() {
  return statements.listActive.all();
}

/** Última invitación sin usar creada por el usuario (puede estar expirada). */
function latestUnusedByUser(userId) {
  return statements.latestUnusedByUser.get(userId);
}

/** Marca como expiradas todas las invitaciones sin usar del usuario. */
function expireUnusedByUser(userId, expiresAt) {
  statements.expireUnusedByUser.run({ userId, expiresAt });
}

module.exports = {
  create,
  findByCode,
  markUsed,
  listActive,
  latestUnusedByUser,
  expireUnusedByUser,
};
