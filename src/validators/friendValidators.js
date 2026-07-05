'use strict';

const { z } = require('zod');

/** Solicitud de amistad: se identifica al destinatario por su nombre de usuario. */
const friendRequestSchema = z.object({
  username: z.string().trim().min(1, 'Escribe un nombre de usuario'),
});

module.exports = { friendRequestSchema };
