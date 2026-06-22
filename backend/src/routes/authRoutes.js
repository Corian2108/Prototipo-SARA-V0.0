const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /api/auth/check-setup - Verifica si el sistema está configurado
router.post('/check-setup', authController.checkSetup);

// POST /api/auth/setup - Configura usuario y contraseña inicial
router.post('/setup', authController.setup);

// POST /api/auth/login - Autentica usuario y crea sesión
router.post('/login', authController.login);

// POST /api/auth/logout - Cierra sesión del usuario
router.post('/logout', authController.logout);

module.exports = router;
