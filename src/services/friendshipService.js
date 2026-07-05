'use strict';

const friendshipRepository = require('../models/friendshipRepository');
const userRepository = require('../models/userRepository');
const { FRIENDSHIP_STATUS } = require('../config/constants');
const { NotFoundError, ConflictError, ForbiddenError } = require('../utils/errors');

/**
 * Reglas del sistema de amigos (relación mutua: solicitud → aceptar). La
 * autorización vive aquí: cada mutación comprueba que el usuario forma parte de
 * la relación antes de tocarla. El feed usa `friendIds` para filtrar.
 */

/**
 * Envía una solicitud de amistad a `toUsername`. Si ya existe una solicitud
 * ENTRANTE del mismo par, la acepta directamente (atajo natural).
 */
function request(fromId, toUsername) {
  const target = userRepository.findByUsername(String(toUsername || '').trim());
  if (!target) throw new NotFoundError('No encontramos a esa persona.');
  if (target.id === fromId) throw new ConflictError('No puedes agregarte a ti mismo.');

  const existing = friendshipRepository.findBetween(fromId, target.id);
  if (existing) {
    if (existing.status === FRIENDSHIP_STATUS.ACCEPTED) {
      throw new ConflictError('Ya son amigos.');
    }
    // Pendiente entrante (la envió el otro) → aceptar. Saliente → ya está pedida.
    if (existing.addressee_id === fromId) {
      return { friendship: friendshipRepository.accept(existing.id), autoAccepted: true };
    }
    throw new ConflictError('Ya enviaste una solicitud a esta persona.');
  }

  return { friendship: friendshipRepository.create(fromId, target.id), autoAccepted: false };
}

/** Carga una relación validando que exista y que `userId` forme parte de ella. */
function loadOwned(userId, friendshipId) {
  const row = friendshipRepository.findById(Number(friendshipId));
  if (!row) throw new NotFoundError('Esa solicitud ya no existe.');
  if (row.requester_id !== userId && row.addressee_id !== userId) {
    throw new ForbiddenError('No tienes permiso para esto.');
  }
  return row;
}

/** Acepta una solicitud entrante (solo el destinatario puede). */
function accept(userId, friendshipId) {
  const row = loadOwned(userId, friendshipId);
  if (row.status !== FRIENDSHIP_STATUS.PENDING || row.addressee_id !== userId) {
    throw new ConflictError('Esa solicitud no se puede aceptar.');
  }
  return friendshipRepository.accept(row.id);
}

/** El otro extremo de la relación (el que no es `userId`). */
function otherOf(row, userId) {
  return row.requester_id === userId ? row.addressee_id : row.requester_id;
}

/** Rechaza una solicitud entrante (destinatario) → borra la fila. */
function decline(userId, friendshipId) {
  const row = loadOwned(userId, friendshipId);
  if (row.status !== FRIENDSHIP_STATUS.PENDING || row.addressee_id !== userId) {
    throw new ConflictError('Esa solicitud no se puede rechazar.');
  }
  friendshipRepository.deleteById(row.id);
  return otherOf(row, userId);
}

/** Cancela una solicitud saliente (solicitante) → borra la fila. */
function cancel(userId, friendshipId) {
  const row = loadOwned(userId, friendshipId);
  if (row.status !== FRIENDSHIP_STATUS.PENDING || row.requester_id !== userId) {
    throw new ConflictError('Esa solicitud no se puede cancelar.');
  }
  friendshipRepository.deleteById(row.id);
  return otherOf(row, userId);
}

/** Elimina una amistad aceptada (cualquiera de los dos) → borra la fila. */
function remove(userId, friendshipId) {
  const row = loadOwned(userId, friendshipId);
  if (row.status !== FRIENDSHIP_STATUS.ACCEPTED) {
    throw new ConflictError('No hay una amistad que eliminar.');
  }
  friendshipRepository.deleteById(row.id);
  return otherOf(row, userId);
}

/** IDs de los amigos aceptados (para filtrar el feed). */
function friendIds(userId) {
  return friendshipRepository.friendIds(userId);
}

/** Nº de solicitudes entrantes pendientes (para el badge del nav). */
function incomingCount(userId) {
  return friendshipRepository.incomingCount(userId);
}

/** Estado de relación de `userId` con `otherId` (para el botón del perfil). */
function statusWith(userId, otherId) {
  if (userId === otherId) return { rel: 'self', friendshipId: null };
  const row = friendshipRepository.findBetween(userId, otherId);
  if (!row) return { rel: 'none', friendshipId: null };
  if (row.status === FRIENDSHIP_STATUS.ACCEPTED) return { rel: 'friends', friendshipId: row.id };
  const rel = row.requester_id === userId ? 'pending_out' : 'pending_in';
  return { rel, friendshipId: row.id };
}

/** Datos para el hub de amigos: amigos, solicitudes y contador entrante. */
function overview(userId) {
  const incoming = friendshipRepository.incoming(userId);
  return {
    friends: friendshipRepository.friends(userId),
    incoming,
    outgoing: friendshipRepository.outgoing(userId),
    pendingCount: incoming.length,
  };
}

/** Directorio de usuarios con estado de relación (para "Descubrir"). */
function directory(userId, search) {
  return friendshipRepository.directory(userId, search);
}

module.exports = {
  request,
  accept,
  decline,
  cancel,
  remove,
  friendIds,
  incomingCount,
  statusWith,
  overview,
  directory,
};
