'use strict';

const express = require('express');
const habitController = require('../../controllers/habitController');
const historyController = require('../../controllers/historyController');
const requireAuth = require('../../middlewares/requireAuth');

const router = express.Router();

router.use(requireAuth);
router.get('/', habitController.page);
router.get('/:id/history', historyController.page);

module.exports = router;
