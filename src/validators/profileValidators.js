'use strict';

const { z } = require('zod');

// Lista curada de zonas horarias comunes (se puede ampliar sin tocar la lógica).
const TIMEZONES = [
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Madrid',
  'UTC',
];

const THEMES = ['dark', 'light'];

// Colores de acento seleccionables (mapeados a tokens --brand-* en tokens.css).
const ACCENTS = ['blue', 'red', 'green', 'purple', 'pink'];

const profileSchema = z.object({
  displayName: z.string().trim().min(1, 'Escribe un nombre').max(40, 'Máximo 40 caracteres'),
  bio: z.string().trim().max(160, 'Máximo 160 caracteres').optional().or(z.literal('')),
  timezone: z.enum(TIMEZONES, { errorMap: () => ({ message: 'Zona horaria no válida' }) }),
  theme: z.enum(THEMES, { errorMap: () => ({ message: 'Tema no válido' }) }),
  accent: z.enum(ACCENTS, { errorMap: () => ({ message: 'Color no válido' }) }),
});

// Preferencias de notificación (formulario propio en el perfil).
const notificationsSchema = z.object({
  reminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora no válida (usa HH:MM)'),
  // El checkbox llega como 'on' si está marcado, o ausente si no.
  streakGuard: z.preprocess(
    (v) => v === 'on' || v === true || v === '1' || v === 'true',
    z.boolean()
  ),
});

const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Escribe tu contraseña actual'),
    newPassword: z.string().min(8, 'Mínimo 8 caracteres').max(200, 'Demasiado larga'),
    newPasswordConfirm: z.string(),
  })
  .refine((d) => d.newPassword === d.newPasswordConfirm, {
    path: ['newPasswordConfirm'],
    message: 'Las contraseñas no coinciden',
  });

module.exports = {
  profileSchema,
  notificationsSchema,
  passwordChangeSchema,
  TIMEZONES,
  THEMES,
  ACCENTS,
};
