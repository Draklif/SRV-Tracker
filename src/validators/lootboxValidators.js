'use strict';

const { z } = require('zod');

/**
 * Abrir/comprar una caja solo necesita su clave: el precio, la tirada y el
 * inventario los pone el servidor (src/config/lootboxes.js). El cliente no puede
 * insinuar qué le toca ni cuánto paga.
 */
const boxSchema = z.object({
  boxKey: z.string().trim().min(1, 'Falta la caja').max(64),
});

module.exports = { boxSchema };
