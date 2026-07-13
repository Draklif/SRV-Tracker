'use strict';

const express = require('express');
const cosmeticsController = require('../../controllers/cosmeticsController');
const requireAuth = require('../../middlewares/requireAuth');
const { verifyCsrf } = require('../../middlewares/csrf');

const router = express.Router();

router.use(requireAuth);

// Equipar/desequipar es una mutación → CSRF por header (igual que friendApiRoutes).
router.post('/equip', verifyCsrf, cosmeticsController.equip);

module.exports = router;
