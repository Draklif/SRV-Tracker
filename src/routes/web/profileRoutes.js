'use strict';

const express = require('express');
const userController = require('../../controllers/userController');
const requireAuth = require('../../middlewares/requireAuth');
const { verifyCsrf } = require('../../middlewares/csrf');
const uploadAvatar = require('../../middlewares/uploadAvatar');

const router = express.Router();

// Todas las rutas de perfil requieren sesión.
router.use(requireAuth);

router.get('/', userController.showProfile);
router.post('/', verifyCsrf, userController.updateProfile);
router.post('/password', verifyCsrf, userController.changePassword);
router.post('/invite', verifyCsrf, userController.generateInvite);

// El avatar es multipart: multer parsea primero (incluido el campo _csrf),
// luego verificamos CSRF.
router.post('/avatar', uploadAvatar, verifyCsrf, userController.uploadAvatar);

module.exports = router;
