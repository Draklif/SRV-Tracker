'use strict';

const express = require('express');
const giftController = require('../../controllers/giftController');
const requireAuth = require('../../middlewares/requireAuth');
const { verifyCsrf } = require('../../middlewares/csrf');

const router = express.Router();

router.use(requireAuth);

// Todas mutan → CSRF por header (igual que el resto de la API).
router.post('/send', verifyCsrf, giftController.send);
router.post('/:id/claim', verifyCsrf, giftController.claim);
router.delete('/:id', verifyCsrf, giftController.remove);

module.exports = router;
