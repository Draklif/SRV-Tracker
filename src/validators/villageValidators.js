'use strict';

const { z } = require('zod');
const { ROOM_TYPE_KEYS } = require('../config/constants');

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

/** Construir una sala en una celda del mapa (floor/col, huella base). */
const buildSchema = z.object({
  roomType: z.enum(ROOM_TYPE_KEYS),
  floor: z.coerce.number().int(),
  col: z.coerce.number().int(),
});

/** Fusionar dos salas contiguas iguales (por id). */
const mergeSchema = z.object({
  roomIdA: z.coerce.number().int().positive(),
  roomIdB: z.coerce.number().int().positive(),
});

/** Mover una sala a otra celda (por id + destino). */
const moveSchema = z.object({
  roomId: z.coerce.number().int().positive(),
  floor: z.coerce.number().int(),
  col: z.coerce.number().int(),
});

/** Mejorar / cancelar / destruir una sala existente (por id). */
const upgradeSchema = z.object({
  roomId: z.coerce.number().int().positive(),
});
const cancelSchema = upgradeSchema;
const destroySchema = upgradeSchema;

/** Acelerar la construcción de una sala (por id). */
const rushSchema = z.object({
  roomId: z.coerce.number().int().positive(),
});

module.exports = {
  createVillageSchema,
  inviteSchema,
  acceptSchema,
  buildSchema,
  mergeSchema,
  moveSchema,
  upgradeSchema,
  cancelSchema,
  destroySchema,
  rushSchema,
};
