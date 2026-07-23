'use strict';

const express = require('express');
const adminController = require('../../controllers/adminController');
const requireAuth = require('../../middlewares/requireAuth');
const requireAdmin = require('../../middlewares/requireAdmin');
const { verifyCsrf } = require('../../middlewares/csrf');

/**
 * API JSON del panel de admin. Todo detrás de requireAuth + requireAdmin, y las
 * mutaciones con CSRF. El camino de difusión (sin cobro) SOLO se expone aquí,
 * para que ningún usuario normal pueda repartir regalos gratis.
 */
const router = express.Router();

router.use(requireAuth, requireAdmin);

// Descuentos
router.post('/discounts', verifyCsrf, adminController.createDiscount);
router.delete('/discounts/:id', verifyCsrf, adminController.deleteDiscount);

// Overrides de tienda (precio / visibilidad)
router.post('/overrides', verifyCsrf, adminController.setOverride);
router.delete('/overrides/:itemKey', verifyCsrf, adminController.deleteOverride);

// Cajas
router.post('/lootboxes', verifyCsrf, adminController.createLootbox);
router.post('/lootboxes/:key/toggle', verifyCsrf, adminController.toggleLootbox);
router.delete('/lootboxes/:key', verifyCsrf, adminController.deleteLootbox);

// Cosméticos
router.post('/cosmetics', verifyCsrf, adminController.createCosmetic);
router.post('/cosmetics/:key/toggle', verifyCsrf, adminController.toggleCosmetic);
router.delete('/cosmetics/:key', verifyCsrf, adminController.deleteCosmetic);

// Difusión
router.post('/broadcast', verifyCsrf, adminController.broadcast);

module.exports = router;
