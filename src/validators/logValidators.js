'use strict';

const { z } = require('zod');

/**
 * Payload de un registro diario. `op` indica la operación; los demás campos son
 * opcionales según el tipo de hábito (los interpreta habitLogService).
 */
const logSchema = z.object({
  op: z.enum(['toggle', 'increment', 'set', 'text', 'clear']),
  amount: z.coerce.number().optional(),
  value: z.coerce.number().optional(),
  text: z.string().max(280, 'Máximo 280 caracteres').optional(),
});

module.exports = { logSchema };
