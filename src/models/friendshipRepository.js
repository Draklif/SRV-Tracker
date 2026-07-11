'use strict';

const db = require('../database/connection');

/**
 * Acceso a datos de amistades. Único lugar con SQL de la tabla `friendships`.
 * Una fila = solicitud (pending) o amistad (accepted); la dirección la dan
 * requester/addressee. Las consultas de "amigos" miran AMBAS direcciones.
 */

const statements = {
  byId: db.prepare('SELECT * FROM friendships WHERE id = ?'),
  // Relación entre dos usuarios en cualquier dirección (para saber el estado actual).
  between: db.prepare(`
    SELECT * FROM friendships
    WHERE (requester_id = @a AND addressee_id = @b)
       OR (requester_id = @b AND addressee_id = @a)
    LIMIT 1
  `),
  insert: db.prepare(`
    INSERT INTO friendships (requester_id, addressee_id) VALUES (@requester_id, @addressee_id)
  `),
  accept: db.prepare(`
    UPDATE friendships SET status = 'accepted', responded_at = datetime('now')
    WHERE id = @id
  `),
  deleteById: db.prepare('DELETE FROM friendships WHERE id = ?'),

  // IDs de amigos aceptados (ambas direcciones) — clave para filtrar el feed.
  friendIds: db.prepare(`
    SELECT addressee_id AS friend_id FROM friendships
      WHERE requester_id = @id AND status = 'accepted'
    UNION
    SELECT requester_id AS friend_id FROM friendships
      WHERE addressee_id = @id AND status = 'accepted'
  `),

  // Amigos aceptados con datos de usuario (para "Mis amigos").
  friends: db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_path, u.xp, f.id AS friendship_id
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.requester_id = @id THEN f.addressee_id ELSE f.requester_id END
    WHERE (f.requester_id = @id OR f.addressee_id = @id) AND f.status = 'accepted'
    ORDER BY u.display_name COLLATE NOCASE
  `),

  // Solicitudes entrantes (otros me pidieron a mí, pendientes).
  incoming: db.prepare(`
    SELECT f.id AS friendship_id, u.id, u.username, u.display_name, u.avatar_path
    FROM friendships f JOIN users u ON u.id = f.requester_id
    WHERE f.addressee_id = @id AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `),
  // Solicitudes salientes (yo pedí, pendientes).
  outgoing: db.prepare(`
    SELECT f.id AS friendship_id, u.id, u.username, u.display_name, u.avatar_path
    FROM friendships f JOIN users u ON u.id = f.addressee_id
    WHERE f.requester_id = @id AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `),
  incomingCount: db.prepare(`
    SELECT COUNT(*) AS n FROM friendships WHERE addressee_id = ? AND status = 'pending'
  `),

  // Directorio: todos los usuarios menos yo, con el estado de relación derivado.
  // pending_out = yo la envié; pending_in = me la enviaron; friends = aceptada.
  directory: db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_path, u.xp,
           f.id AS friendship_id,
           CASE
             WHEN f.status = 'accepted' THEN 'friends'
             WHEN f.status = 'pending' AND f.requester_id = @id THEN 'pending_out'
             WHEN f.status = 'pending' THEN 'pending_in'
             ELSE 'none'
           END AS rel
    FROM users u
    LEFT JOIN friendships f
      ON (f.requester_id = @id AND f.addressee_id = u.id)
      OR (f.addressee_id = @id AND f.requester_id = u.id)
    WHERE u.id <> @id
      AND (@search = '' OR u.username LIKE @like OR u.display_name LIKE @like)
    ORDER BY u.display_name COLLATE NOCASE
    LIMIT 100
  `),
};

function findById(id) {
  return statements.byId.get(id);
}

/** Fila de relación entre dos usuarios (cualquier dirección) o undefined. */
function findBetween(a, b) {
  return statements.between.get({ a, b });
}

/** Crea una solicitud pendiente. Devuelve la fila creada. */
function create(requesterId, addresseeId) {
  const info = statements.insert.run({ requester_id: requesterId, addressee_id: addresseeId });
  return statements.byId.get(info.lastInsertRowid);
}

function accept(id) {
  statements.accept.run({ id });
  return statements.byId.get(id);
}

function deleteById(id) {
  statements.deleteById.run(id);
}

/** IDs (números) de los amigos aceptados de un usuario. */
function friendIds(userId) {
  return statements.friendIds.all({ id: userId }).map((r) => r.friend_id);
}

function friends(userId) {
  return statements.friends.all({ id: userId });
}

function incoming(userId) {
  return statements.incoming.all({ id: userId });
}

function outgoing(userId) {
  return statements.outgoing.all({ id: userId });
}

function incomingCount(userId) {
  return statements.incomingCount.get(userId).n;
}

/** Directorio de usuarios con el estado de relación respecto a `userId`. */
function directory(userId, search = '') {
  const term = String(search || '').trim();
  return statements.directory.all({ id: userId, search: term, like: `%${term}%` });
}

module.exports = {
  findById,
  findBetween,
  create,
  accept,
  deleteById,
  friendIds,
  friends,
  incoming,
  outgoing,
  incomingCount,
  directory,
};
