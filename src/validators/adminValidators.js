'use strict';

const { z } = require('zod');

/**
 * Esquemas del panel de admin. Solo sanean la FORMA; las reglas de dominio
 * (que la clave exista, que el objeto sea vendible, rangos finos) las pone
 * adminService contra los catálogos. El precio nunca lo decide el cliente.
 */

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida (AAAA-MM-DD).');

const createDiscountSchema = z.object({
  itemKey: z.string().trim().min(1, 'Falta el objeto.').max(64),
  percent: z.coerce.number().int().min(0).max(90),
  startsOn: z.union([DATE, z.literal('')]).optional(),
  endsOn: z.union([DATE, z.literal('')]).optional(),
});

const broadcastSchema = z.object({
  type: z.enum(['coins', 'lootbox', 'cosmetic']),
  key: z.string().trim().max(64).optional(),
  amount: z.coerce.number().int().positive().optional(),
  message: z.string().trim().max(200).optional(),
});

// Override de tienda: precio (omitido = sin override) y visibilidad tri-estado
// (keep = no tocar, show = forzar visible, hide = forzar oculto).
const setOverrideSchema = z.object({
  itemKey: z.string().trim().min(1).max(64),
  price: z.coerce.number().int().min(0).optional(),
  hidden: z.enum(['keep', 'show', 'hide']).default('keep'),
});

const createLootboxSchema = z.object({
  name: z.string().trim().min(1).max(60),
  price: z.coerce.number().int().min(0),
  art: z.string().trim().min(1).max(32),
  description: z.string().trim().max(200).optional(),
  pool: z.array(z.string().trim().min(1).max(64)).min(2, 'Elige al menos 2 objetos.'),
});

const createCosmeticSchema = z.object({
  slot: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(60),
  rarity: z.string().trim().min(1).max(32),
  price: z.coerce.number().int().min(0).default(0),
  hidden: z.boolean().optional(),
  css: z.string().trim().max(64).optional(),
  glyph: z.string().trim().max(8).optional(),
  text: z.string().trim().max(40).optional(),
  gap: z.boolean().optional(),
  innerBorder: z.boolean().optional(),
  replaceBorder: z.boolean().optional(),
  ink: z.enum(['', 'dark', 'light']).optional(),
});

module.exports = {
  createDiscountSchema,
  broadcastSchema,
  setOverrideSchema,
  createLootboxSchema,
  createCosmeticSchema,
};
