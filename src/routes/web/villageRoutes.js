'use strict';

const express = require('express');
const villageController = require('../../controllers/villageController');
const requireAuth = require('../../middlewares/requireAuth');

const router = express.Router();

router.use(requireAuth);

router.get('/', villageController.page);

module.exports = router;
