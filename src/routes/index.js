'use strict';

const express = require('express');
const homeController = require('../controllers/homeController');
const authRoutes = require('./web/authRoutes');
const profileRoutes = require('./web/profileRoutes');
const habitRoutes = require('./web/habitRoutes');
const habitApiRoutes = require('./api/habitApiRoutes');
const socialApiRoutes = require('./api/socialApiRoutes');
const friendApiRoutes = require('./api/friendApiRoutes');
const pushApiRoutes = require('./api/pushApiRoutes');
const cosmeticsApiRoutes = require('./api/cosmeticsApiRoutes');
const shopApiRoutes = require('./api/shopApiRoutes');
const socialController = require('../controllers/socialController');
const changelogController = require('../controllers/changelogController');
const cosmeticsController = require('../controllers/cosmeticsController');
const shopController = require('../controllers/shopController');
const requireAuth = require('../middlewares/requireAuth');

/**
 * Router raíz: monta todos los sub-routers de la app.
 * A medida que crezcan los dominios se irán añadiendo aquí (habits, social, …).
 */
const router = express.Router();

// Chequeo de salud para monitoreo/despliegue.
router.get('/healthz', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Fecha local "hoy" del usuario: el cliente la usa para detectar el cambio de
// día y recargar (evita dashboards obsoletos con la pestaña abierta de ayer).
router.get('/api/today', requireAuth, (req, res) => {
  res.json({ date: require('../utils/date').todayFor(req.user.timezone) });
});

// Inicio (landing pública o home del usuario autenticado).
router.get('/', homeController.index);

// Dominios (páginas).
router.use('/', authRoutes);
router.use('/profile', profileRoutes);
router.use('/habits', habitRoutes);
router.get('/social', requireAuth, socialController.page);
router.get('/novedades', requireAuth, changelogController.page);
router.get('/coleccion', requireAuth, cosmeticsController.page);
router.get('/tienda', requireAuth, shopController.page);
router.get('/u/:username', requireAuth, require('../controllers/userController').showFriend);

// API JSON.
router.use('/api/habits', habitApiRoutes);
router.use('/api/friends', friendApiRoutes);
router.use('/api/push', pushApiRoutes);
router.use('/api/cosmetics', cosmeticsApiRoutes);
router.use('/api/shop', shopApiRoutes);
router.use('/api', socialApiRoutes);

module.exports = router;
