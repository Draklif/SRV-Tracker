'use strict';

const path = require('path');
require('dotenv').config();

const rootDir = path.resolve(__dirname, '..', '..');
const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';

/**
 * Configuración central de la aplicación.
 * Todo acceso a `process.env` vive aquí; el resto del código lee de `config`.
 */
const config = {
  env,
  isProd,
  port: Number(process.env.PORT) || 3000,
  rootDir,

  database: {
    // Ruta absoluta al archivo SQLite.
    path: path.resolve(rootDir, process.env.DATABASE_PATH || 'data/tracker.db'),
  },

  session: {
    secret: process.env.SESSION_SECRET || 'dev-session-secret-inseguro',
    // 30 días en milisegundos.
    maxAge: 30 * 24 * 60 * 60 * 1000,
  },

  csrf: {
    secret: process.env.CSRF_SECRET || 'dev-csrf-secret-inseguro',
  },

  defaultTimezone: process.env.DEFAULT_TIMEZONE || 'America/Mexico_City',

  // Web Push (notificaciones). Las claves VAPID se generan en el servidor
  // (`npx web-push generate-vapid-keys`) y se inyectan como env. Sin ellas, el
  // envío queda deshabilitado (pushService lo detecta y no hace nada).
  push: {
    vapidPublic: process.env.VAPID_PUBLIC_KEY || '',
    vapidPrivate: process.env.VAPID_PRIVATE_KEY || '',
    vapidSubject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    // Hora local (0-23) a la que se avisa "tu racha peligra" si el usuario lo activó.
    streakGuardHour: Number(process.env.NOTIFY_STREAK_GUARD_HOUR) || 21,
  },

  // Metadatos del sitio para el <head> y las previews sociales (Open Graph).
  site: {
    name: 'Tracker',
    description:
      process.env.SITE_DESCRIPTION ||
      'Rastreador de hábitos gamificado y acogedor para compartir con tus amigos.',
    // URL pública canónica (con https), ej. https://tracker.midominio.com.
    // Si se deja vacía, se deriva del host de la petición.
    url: (process.env.PUBLIC_URL || '').replace(/\/+$/, ''),
  },

  paths: {
    uploads: path.resolve(rootDir, 'public/uploads'),
    avatars: path.resolve(rootDir, 'public/uploads/avatars'),
  },
};

module.exports = config;
