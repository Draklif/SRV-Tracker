'use strict';

const { z } = require('zod');

/**
 * Comprar solo necesita la clave del objeto: el precio y el saldo los pone el
 * servidor desde el catálogo (src/config/cosmetics.js). Que el cliente no pueda
 * ni siquiera insinuar un precio es lo que hace la tienda inviolable.
 */
const buySchema = z.object({
  itemKey: z.string().trim().min(1, 'Falta el objeto').max(64),
});

module.exports = { buySchema };
