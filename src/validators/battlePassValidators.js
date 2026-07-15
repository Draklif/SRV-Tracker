'use strict';

const { z } = require('zod');

/**
 * Reclamar un tier necesita el nivel y el carril. Lo demás (si llegaste a ese
 * nivel, si tienes premium, si ya lo reclamaste) lo decide el servidor.
 */
const claimSchema = z.object({
  level: z.coerce.number().int().positive('Nivel inválido'),
  track: z.enum(['free', 'premium']),
});

module.exports = { claimSchema };
