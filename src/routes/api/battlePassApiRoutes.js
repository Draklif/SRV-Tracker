'use strict';

const express = require('express');
const battlePassController = require('../../controllers/battlePassController');
const requireAuth = require('../../middlewares/requireAuth');
const { verifyCsrf } = require('../../middlewares/csrf');

const router = express.Router();

router.use(requireAuth);

// Desbloquear el premium y reclamar recompensas mueven monedas/objetos → CSRF.
router.post('/premium', verifyCsrf, battlePassController.premium);
router.post('/claim', verifyCsrf, battlePassController.claim);

module.exports = router;
