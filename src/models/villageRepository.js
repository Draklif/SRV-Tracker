'use strict';

const db = require('../database/connection');

/**
 * Acceso a datos de colonias. Único lugar con SQL de la tabla `villages`.
 * La membresía vive en villageMemberRepository (patrón heredado de friendships).
 */

const statements = {
  byId: db.prepare('SELECT * FROM villages WHERE id = ?'),
  insert: db.prepare('INSERT INTO villages (name, created_by) VALUES (@name, @created_by)'),
  // Colonia donde el usuario es miembro ACTIVO (por ahora, a lo sumo una).
  activeByUser: db.prepare(`
    SELECT v.* FROM villages v
    JOIN village_members m ON m.village_id = v.id
    WHERE m.user_id = @user_id AND m.status = 'active'
    LIMIT 1
  `),
};

function findById(id) {
  return statements.byId.get(id);
}

/** Crea la colonia y devuelve la fila. */
function create(name, createdBy) {
  const info = statements.insert.run({ name, created_by: createdBy });
  return statements.byId.get(info.lastInsertRowid);
}

/** Colonia activa del usuario, o undefined. */
function findActiveByUser(userId) {
  return statements.activeByUser.get({ user_id: userId });
}

module.exports = { findById, create, findActiveByUser };
