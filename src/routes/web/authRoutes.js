'use strict';

const express = require('express');
const authController = require('../../controllers/authController');
const requireGuest = require('../../middlewares/requireGuest');
const requireAuth = require('../../middlewares/requireAuth');
const { verifyCsrf } = require('../../middlewares/csrf');
const { authLimiter } = require('../../middlewares/rateLimit');

const router = express.Router();

router.get('/register', requireGuest, authController.showRegister);
router.post('/register', requireGuest, authLimiter, verifyCsrf, authController.register);

router.get('/login', requireGuest, authController.showLogin);
router.post('/login', requireGuest, authLimiter, verifyCsrf, authController.login);

router.post('/logout', requireAuth, verifyCsrf, authController.logout);

module.exports = router;
