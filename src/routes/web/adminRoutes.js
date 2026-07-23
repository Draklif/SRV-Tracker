'use strict';

const express = require('express');
const adminController = require('../../controllers/adminController');
const requireAuth = require('../../middlewares/requireAuth');
const requireAdmin = require('../../middlewares/requireAdmin');

/**
 * Páginas del panel de admin. requireAdmin va DESPUÉS de requireAuth: para un no
 * admin la respuesta es un 404 idéntico al de una ruta inexistente (el panel no
 * es ni descubrible).
 */
const router = express.Router();

router.use(requireAuth, requireAdmin);

// Una sola página; las pestañas cambian el contenido en el cliente.
router.get('/', adminController.page);

module.exports = router;
