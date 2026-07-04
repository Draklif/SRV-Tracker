'use strict';

const express = require('express');
const socialController = require('../../controllers/socialController');
const requireAuth = require('../../middlewares/requireAuth');
const { verifyCsrf } = require('../../middlewares/csrf');

const router = express.Router();

router.use(requireAuth);

// Lecturas (GET, sin CSRF): stream en vivo y items nuevos del feed.
router.get('/stream', socialController.stream);
router.get('/feed/latest', socialController.latest);

// Mutaciones (CSRF por header).
router.post('/activity/:id/react', verifyCsrf, socialController.react);

module.exports = router;
