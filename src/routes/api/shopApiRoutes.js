'use strict';

const express = require('express');
const shopController = require('../../controllers/shopController');
const requireAuth = require('../../middlewares/requireAuth');
const { verifyCsrf } = require('../../middlewares/csrf');

const router = express.Router();

router.use(requireAuth);

// Comprar mueve dinero → CSRF por header (igual que el resto de mutaciones).
router.post('/buy', verifyCsrf, shopController.buy);

module.exports = router;
