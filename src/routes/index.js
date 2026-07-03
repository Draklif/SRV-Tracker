'use strict';

const express = require('express');
const homeController = require('../controllers/homeController');

/**
 * Router raíz: monta todos los sub-routers de la app.
 * A medida que crezcan los dominios se irán añadiendo aquí (auth, habits, …).
 */
const router = express.Router();

// Chequeo de salud para monitoreo/despliegue.
router.get('/healthz', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Landing pública.
router.get('/', homeController.landing);

module.exports = router;
