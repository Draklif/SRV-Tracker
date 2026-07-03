'use strict';

const session = require('express-session');
const SqliteStore = require('better-sqlite3-session-store')(session);

const config = require('../config');
const db = require('../database/connection');

/**
 * Middleware de sesión. Guarda las sesiones en SQLite (misma base de datos) y
 * limpia las expiradas periódicamente. La cookie es httpOnly y sameSite=lax.
 */
module.exports = session({
  store: new SqliteStore({
    client: db,
    expired: { clear: true, intervalMs: 15 * 60 * 1000 },
  }),
  name: 'tracker.sid',
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: config.session.maxAge,
  },
});
