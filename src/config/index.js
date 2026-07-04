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
