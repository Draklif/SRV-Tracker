'use strict';

const { z } = require('zod');

/**
 * Enviar un regalo a un amigo. Entre usuarios SOLO se regalan cajas, así que el
 * tipo es fijo ('lootbox') y hace falta la clave de la caja. El precio y el saldo
 * los pone SIEMPRE el servidor (giftService); el resto de reglas (amigo,
 * auto-regalo) también viven en el service. Aquí solo se sanea la forma.
 */
const sendGiftSchema = z.object({
  recipientId: z.coerce.number().int().positive('Falta el destinatario.'),
  type: z.literal('lootbox').default('lootbox'),
  key: z.string().trim().min(1, 'Falta la caja.').max(64),
  message: z.string().trim().max(200).optional(),
});

module.exports = { sendGiftSchema };
