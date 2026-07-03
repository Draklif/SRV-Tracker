'use strict';

const { z } = require('zod');

const username = z
  .string()
  .trim()
  .min(3, 'Mínimo 3 caracteres')
  .max(20, 'Máximo 20 caracteres')
  .regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guion bajo');

const password = z.string().min(8, 'Mínimo 8 caracteres').max(200, 'Demasiado larga');

// Campos opcionales que el formulario envía como cadena vacía cuando van en blanco.
const optionalDisplayName = z.string().trim().max(40, 'Máximo 40 caracteres').optional().or(z.literal(''));
const optionalEmail = z
  .string()
  .trim()
  .email('Email no válido')
  .optional()
  .or(z.literal(''));

const registerSchema = z
  .object({
    username,
    displayName: optionalDisplayName,
    email: optionalEmail,
    password,
    passwordConfirm: z.string(),
    inviteCode: z.string().trim().min(1, 'Necesitas un código de invitación'),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ['passwordConfirm'],
    message: 'Las contraseñas no coinciden',
  });

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Escribe tu usuario'),
  password: z.string().min(1, 'Escribe tu contraseña'),
});

module.exports = { registerSchema, loginSchema };
