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
  // Suma (o resta, con delta negativo) créditos; nunca baja de 0.
  addCredits: db.prepare(
    'UPDATE villages SET credits = MAX(0, credits + @delta) WHERE id = @id'
  ),
  setCredits: db.prepare('UPDATE villages SET credits = @credits WHERE id = @id'),
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

/** Suma (o resta) créditos a la colonia. Nunca baja de 0. */
function addCredits(id, delta) {
  statements.addCredits.run({ id, delta });
}

/** Fija los créditos de la colonia (utilidad de desarrollo). */
function setCredits(id, credits) {
  statements.setCredits.run({ id, credits });
}

module.exports = { findById, create, findActiveByUser, addCredits, setCredits };
