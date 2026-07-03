'use strict';

const express = require('express');
const homeController = require('../controllers/homeController');
const authRoutes = require('./web/authRoutes');
const profileRoutes = require('./web/profileRoutes');

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

// Dominios.
router.use('/', authRoutes);
router.use('/profile', profileRoutes);

module.exports = router;
