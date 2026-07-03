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

module.exports = { create, findByCode, markUsed, listActive };
