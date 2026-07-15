'use strict';

const express = require('express');
const lootboxController = require('../../controllers/lootboxController');
const requireAuth = require('../../middlewares/requireAuth');
const { verifyCsrf } = require('../../middlewares/csrf');

const router = express.Router();

router.use(requireAuth);

// Previsualizar es solo lectura: no mueve nada, no necesita CSRF.
router.get('/:boxKey/preview', lootboxController.preview);

// Comprar y abrir mueven monedas/objetos → CSRF por header.
router.post('/buy', verifyCsrf, lootboxController.buy); // compra y abre
router.post('/purchase', verifyCsrf, lootboxController.purchase); // compra sin abrir
router.post('/open', verifyCsrf, lootboxController.open); // abre una del inventario

module.exports = router;
