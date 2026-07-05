'use strict';

const db = require('../database/connection');

/**
 * Acceso a datos de membresía de colonia. Único lugar con SQL de
 * `village_members`. Una fila = invitación (pending) o pertenencia (active),
 * mismo patrón que friendships.
 */

const statements = {
  byVillageAndUser: db.prepare(
    'SELECT * FROM village_members WHERE village_id = @village_id AND user_id = @user_id'
  ),
  insert: db.prepare(`
    INSERT INTO village_members (village_id, user_id, role, status, invited_by, joined_at)
    VALUES (@village_id, @user_id, @role, @status, @invited_by, @joined_at)
  `),
  activate: db.prepare(`
    UPDATE village_members SET status = 'active', joined_at = datetime('now')
    WHERE id = @id
  `),
  // Miembros de una colonia (activos y pendientes) con datos de usuario.
  listByVillage: db.prepare(`
    SELECT m.id AS membership_id, m.role, m.status, m.joined_at,
           u.id, u.username, u.display_name, u.avatar_path, u.xp
    FROM village_members m JOIN users u ON u.id = m.user_id
    WHERE m.village_id = @village_id
    ORDER BY (m.status = 'active') DESC, u.display_name COLLATE NOCASE
  `),
  // ¿El usuario ya es miembro ACTIVO de alguna colonia? (regla: 1 activa por usuario)
  activeCount: db.prepare(
    "SELECT COUNT(*) AS n FROM village_members WHERE user_id = ? AND status = 'active'"
  ),
  // Invitaciones pendientes del usuario (para la pantalla "unirse"), con datos de
  // la colonia y de quién invitó.
  pendingInvites: db.prepare(`
    SELECT m.id AS membership_id, v.id AS village_id, v.name AS village_name,
           u.display_name AS invited_by_name
    FROM village_members m
    JOIN villages v ON v.id = m.village_id
    LEFT JOIN users u ON u.id = m.invited_by
    WHERE m.user_id = @user_id AND m.status = 'pending'
    ORDER BY m.created_at DESC
  `),
};

function findMembership(villageId, userId) {
  return statements.byVillageAndUser.get({ village_id: villageId, user_id: userId });
}

/** Inserta una membresía. Devuelve la fila creada. */
function insert({ villageId, userId, role = 'member', status = 'pending', invitedBy = null, joinedAt = null }) {
  statements.insert.run({
    village_id: villageId,
    user_id: userId,
    role,
    status,
    invited_by: invitedBy,
    joined_at: joinedAt,
  });
  return findMembership(villageId, userId);
}

/** Marca una membresía pendiente como activa (fija joined_at). */
function activate(membershipId) {
  statements.activate.run({ id: membershipId });
}

function listByVillage(villageId) {
  return statements.listByVillage.all({ village_id: villageId });
}

/** true si el usuario ya pertenece activamente a alguna colonia. */
function hasActiveMembership(userId) {
  return statements.activeCount.get(userId).n > 0;
}

/** Invitaciones pendientes del usuario: [{ membership_id, village_id, village_name, invited_by_name }]. */
function pendingInvites(userId) {
  return statements.pendingInvites.all({ user_id: userId });
}

module.exports = {
  findMembership,
  insert,
  activate,
  listByVillage,
  hasActiveMembership,
  pendingInvites,
};
