'use strict';

const { z } = require('zod');
const { HABIT_COLOR_KEYS } = require('../config/constants');

// Campos comunes a todos los tipos.
const name = z.string().trim().min(1, 'Ponle un nombre').max(40, 'Máximo 40 caracteres');
const icon = z.string().trim().min(1, 'Elige un icono').max(8, 'Icono demasiado largo');
const color = z.enum(HABIT_COLOR_KEYS, { errorMap: () => ({ message: 'Color no válido' }) });

const optionalUnit = z.string().trim().max(12, 'Máximo 12 caracteres').optional().or(z.literal(''));
const positive = z.coerce
  .number({ invalid_type_error: 'Indica una meta válida', required_error: 'Indica una meta' })
  .positive('Debe ser mayor que 0');
const quickAdd = z.array(z.coerce.number().positive()).max(6, 'Máximo 6 botones').optional();
const requiredUnit = z
  .string({ required_error: 'Indica la unidad' })
  .trim()
  .min(1, 'Indica la unidad')
  .max(12, 'Máximo 12 caracteres');

// Un esquema por tipo (unión discriminada por `type`).
const checkbox = z.object({ type: z.literal('checkbox'), name, icon, color });
const quantity = z.object({
  type: z.literal('quantity'),
  name,
  icon,
  color,
  unit: requiredUnit,
  targetDaily: positive,
  quickAdd,
});
const duration = z.object({
  type: z.literal('duration'),
  name,
  icon,
  color,
  unit: optionalUnit,
  targetDaily: positive.optional(),
  quickAdd,
});
const scale = z.object({
  type: z.literal('scale'),
  name,
  icon,
  color,
  scaleMin: z.coerce.number().int().min(0).max(10),
  scaleMax: z.coerce.number().int().min(1).max(10),
});
const numeric = z.object({
  type: z.literal('numeric'),
  name,
  icon,
  color,
  unit: optionalUnit,
  targetDaily: z.coerce.number().optional(),
});
const text = z.object({ type: z.literal('text'), name, icon, color });

const habitSchema = z.discriminatedUnion('type', [checkbox, quantity, duration, scale, numeric, text]);

module.exports = { habitSchema };
