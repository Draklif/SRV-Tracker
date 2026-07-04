'use strict';

const express = require('express');
const homeController = require('../controllers/homeController');
const authRoutes = require('./web/authRoutes');
const profileRoutes = require('./web/profileRoutes');
const habitRoutes = require('./web/habitRoutes');
const habitApiRoutes = require('./api/habitApiRoutes');

/**
 * Router raíz: monta todos los sub-routers de la app.
 * A medida que crezcan los dominios se irán añadiendo aquí (habits, social, …).
 */
const router = express.Router();

// Chequeo de salud para monitoreo/despliegue.
router.get('/healthz', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Inicio (landing pública o home del usuario autenticado).
router.get('/', homeController.index);

// Dominios (páginas).
router.use('/', authRoutes);
router.use('/profile', profileRoutes);
router.use('/habits', habitRoutes);

// API JSON.
router.use('/api/habits', habitApiRoutes);

module.exports = router;
