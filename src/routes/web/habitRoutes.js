'use strict';

const express = require('express');
const habitController = require('../../controllers/habitController');
const requireAuth = require('../../middlewares/requireAuth');

const router = express.Router();

router.use(requireAuth);
router.get('/', habitController.page);

module.exports = router;
