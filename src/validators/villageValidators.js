'use strict';

const { z } = require('zod');
const { ROOM_TYPE_KEYS, VILLAGE_MAX_SLOTS } = require('../config/constants');

/** Crear una colonia: solo un nombre. */
const createVillageSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(40, 'Máximo 40 caracteres'),
});

/** Invitar a un amigo (por id de usuario). */
const inviteSchema = z.object({
  friendId: z.coerce.number().int().positive('Persona no válida'),
});

/** Aceptar una invitación (por id de colonia). */
const acceptSchema = z.object({
  villageId: z.coerce.number().int().positive(),
});

/** Construir una sala en un slot. */
const buildSchema = z.object({
  roomType: z.enum(ROOM_TYPE_KEYS),
  slotIndex: z.coerce.number().int().min(0).max(VILLAGE_MAX_SLOTS - 1),
});

/** Mejorar una sala existente (por id). */
const upgradeSchema = z.object({
  roomId: z.coerce.number().int().positive(),
});

/** Acelerar la construcción de una sala (por id). */
const rushSchema = z.object({
  roomId: z.coerce.number().int().positive(),
});

module.exports = { createVillageSchema, inviteSchema, acceptSchema, buildSchema, upgradeSchema, rushSchema };
