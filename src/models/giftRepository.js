'use strict';

const db = require('../database/connection');

/**
 * Acceso a datos de los regalos (tabla gifts). Único lugar con SQL de la tabla.
 * La lógica (cobro al enviar, concesión al reclamar) vive en giftService.
 */

const statements = {
  insert: db.prepare(`
    INSERT INTO gifts (sender_id, recipient_id, type, payload_key, amount, message, broadcast_id)
    VALUES (@sender_id, @recipient_id, @type, @payload_key, @amount, @message, @broadcast_id)
  `),
  byId: db.prepare('SELECT * FROM gifts WHERE id = ?'),

  // Reclamar es un UPDATE CON GUARDA: solo pasa de 'pending' a 'claimed' si la
  // fila es del receptor y sigue pendiente. Devuelve changes: si es 0, o ya se
  // reclamó o no es suyo, y no se concede nada. Es el mismo idioma que
  // spendCoins/takeOne, y es lo que hace imposible el doble-cobro aunque lleguen
  // dos reclamaciones a la vez.
  claim: db.prepare(`
    UPDATE gifts SET status = 'claimed', claimed_at = datetime('now')
    WHERE id = @id AND recipient_id = @recipient_id AND status = 'pending'
  `),

  // Solo se puede borrar de la bandeja lo YA reclamado (y solo lo tuyo): un
  // pendiente no se borra, se reclama. Guarda por status para no perder un regalo.
  deleteClaimed: db.prepare(
    "DELETE FROM gifts WHERE id = @id AND recipient_id = @recipient_id AND status = 'claimed'"
  ),

  // Bandeja del receptor: pendientes primero, del más nuevo al más viejo. Trae
  // el nombre del emisor para pintar "de @fulano" (NULL en difusiones de admin).
  inbox: db.prepare(`
    SELECT g.*, s.username AS sender_username, s.display_name AS sender_display_name
    FROM gifts g
    LEFT JOIN users s ON s.id = g.sender_id
    WHERE g.recipient_id = @id
    ORDER BY (g.status = 'pending') DESC, g.created_at DESC
    LIMIT 100
  `),
  pendingCount: db.prepare(
    "SELECT COUNT(*) AS n FROM gifts WHERE recipient_id = ? AND status = 'pending'"
  ),
  maxBroadcastId: db.prepare('SELECT MAX(broadcast_id) AS m FROM gifts'),
};

/** Inserta un regalo pendiente. Devuelve la fila creada. */
function create({
  senderId = null,
  recipientId,
  type,
  payloadKey = null,
  amount = null,
  message = null,
  broadcastId = null,
}) {
  const info = statements.insert.run({
    sender_id: senderId,
    recipient_id: recipientId,
    type,
    payload_key: payloadKey,
    amount,
    message,
    broadcast_id: broadcastId,
  });
  return statements.byId.get(info.lastInsertRowid);
}

function findById(id) {
  return statements.byId.get(id);
}

/** Marca un regalo como reclamado (con guarda). Devuelve true si se reclamó. */
function claim(id, recipientId) {
  return statements.claim.run({ id, recipient_id: recipientId }).changes > 0;
}

/** Borra un regalo YA reclamado del usuario. Devuelve true si se borró. */
function removeClaimed(id, recipientId) {
  return statements.deleteClaimed.run({ id, recipient_id: recipientId }).changes > 0;
}

/** La bandeja del usuario: regalos recibidos, pendientes primero. */
function inbox(userId) {
  return statements.inbox.all({ id: userId });
}

/** Cuántos regalos pendientes de reclamar tiene el usuario (para el badge). */
function pendingCount(userId) {
  return statements.pendingCount.get(userId).n;
}

/** Siguiente id de difusión libre (agrupa todas las filas de un mismo broadcast). */
function nextBroadcastId() {
  return (statements.maxBroadcastId.get().m || 0) + 1;
}

module.exports = {
  create,
  findById,
  claim,
  removeClaimed,
  inbox,
  pendingCount,
  nextBroadcastId,
};
