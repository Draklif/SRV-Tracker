'use strict';

const express = require('express');
const pushController = require('../../controllers/pushController');
const requireAuth = require('../../middlewares/requireAuth');
const { verifyCsrf } = require('../../middlewares/csrf');

const router = express.Router();

router.use(requireAuth);

// Todas son mutaciones → CSRF por header (igual que el resto de la API).
router.post('/subscribe', verifyCsrf, pushController.subscribe);
router.post('/unsubscribe', verifyCsrf, pushController.unsubscribe);
router.post('/test', verifyCsrf, pushController.test);

module.exports = router;
