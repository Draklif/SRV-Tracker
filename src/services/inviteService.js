'use strict';

const inviteRepository = require('../models/inviteRepository');
const withTransaction = require('../database/withTransaction');
const { generateInviteCode } = require('../utils/inviteCode');
const { INVITE_TTL_MINUTES } = require('../config/constants');

/**
 * Invitaciones que generan los propios usuarios desde su perfil. Cada usuario
 * tiene como mucho un código activo a la vez: caduca a la hora, al usarse o al
 * generar uno nuevo. Las fechas se guardan como ISO UTC para comparar en JS sin
 * ambigüedad de zona horaria (ver validateInvite en authService).
 */

const TTL_MS = INVITE_TTL_MINUTES * 60 * 1000;

/** Código activo del usuario (sin usar y sin expirar), o null. */
function getActiveForUser(userId) {
  const invite = inviteRepository.latestUnusedByUser(userId);
  if (!invite) return null;
  if (invite.expires_at && new Date(invite.expires_at) <= new Date()) return null;
  return invite;
}

/**
 * Genera un código nuevo para el usuario: expira cualquier código previo sin
 * usar y crea uno con INVITE_TTL_MINUTES de vida. Devuelve el nuevo código.
 */
function generateForUser(userId) {
  return withTransaction(() => {
    const now = new Date();
    inviteRepository.expireUnusedByUser(userId, now.toISOString());
    const code = generateInviteCode();
    const expiresAt = new Date(now.getTime() + TTL_MS).toISOString();
    inviteRepository.create({ code, createdBy: userId, expiresAt });
    return { code, expires_at: expiresAt };
  });
}

module.exports = { getActiveForUser, generateForUser, INVITE_TTL_MINUTES };
