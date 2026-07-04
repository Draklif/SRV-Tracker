'use strict';

const express = require('express');
const habitController = require('../../controllers/habitController');
const requireAuth = require('../../middlewares/requireAuth');
const { verifyCsrf } = require('../../middlewares/csrf');

const router = express.Router();

// Todas las rutas mutan estado y requieren sesión + token CSRF (por header).
router.use(requireAuth, verifyCsrf);

router.post('/', habitController.create);
router.post('/reorder', habitController.reorder);
router.patch('/:id', habitController.update);
router.delete('/:id', habitController.archive);
router.post('/:id/restore', habitController.restore);

module.exports = router;
