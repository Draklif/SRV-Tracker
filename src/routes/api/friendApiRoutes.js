'use strict';

const express = require('express');
const friendController = require('../../controllers/friendController');
const requireAuth = require('../../middlewares/requireAuth');
const { verifyCsrf } = require('../../middlewares/csrf');

const router = express.Router();

router.use(requireAuth);

// Todas son mutaciones → CSRF por header (igual que socialApiRoutes).
router.post('/request', verifyCsrf, friendController.request);
router.post('/:id/accept', verifyCsrf, friendController.accept);
router.post('/:id/decline', verifyCsrf, friendController.decline);
router.post('/:id/cancel', verifyCsrf, friendController.cancel);
router.delete('/:id', verifyCsrf, friendController.remove);

module.exports = router;
