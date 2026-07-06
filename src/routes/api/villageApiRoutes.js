'use strict';

const express = require('express');
const villageController = require('../../controllers/villageController');
const requireAuth = require('../../middlewares/requireAuth');
const { verifyCsrf } = require('../../middlewares/csrf');

const router = express.Router();

router.use(requireAuth);

// Todas son mutaciones → CSRF por header.
router.post('/', verifyCsrf, villageController.create);
router.post('/invite', verifyCsrf, villageController.invite);
router.post('/accept', verifyCsrf, villageController.accept);
router.post('/build', verifyCsrf, villageController.build);
router.post('/merge', verifyCsrf, villageController.merge);
router.post('/move', verifyCsrf, villageController.move);
router.post('/upgrade', verifyCsrf, villageController.upgrade);
router.post('/cancel', verifyCsrf, villageController.cancel);
router.post('/destroy', verifyCsrf, villageController.destroy);
router.post('/rush', verifyCsrf, villageController.rush);
router.post('/dev/refill', verifyCsrf, villageController.devRefill);

module.exports = router;
