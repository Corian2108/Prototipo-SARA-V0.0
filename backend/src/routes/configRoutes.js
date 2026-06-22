const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');

// GET /api/config - Obtiene la configuración actual del sistema de riego
router.get('/', configController.obtenerConfiguracion);

// PUT /api/config - Actualiza parámetros de la configuración de riego
router.put('/', configController.actualizarConfiguracion);

module.exports = router;
