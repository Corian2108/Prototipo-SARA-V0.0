const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');

// GET /api/config - Devuelve las configuraciones activas (alias rápido)
router.get('/', configController.getConfigActive);

// GET /api/config/history - Devuelve todo el historial de configuraciones
router.get('/history', configController.getConfigHistory);

// GET /api/config/active - Devuelve solo las configuraciones activas
router.get('/active', configController.getConfigActive);

// POST /api/config/add - Crea una nueva configuración de riego
// Recibe JSON con: growthStage, plant, minHumidity, objHumidity, timeBetweenCycles (opcional),
// timeBetweenMeasurements (opcional), irrigationDescription y token
router.post('/add', configController.addConfig);

// PUT /api/config/update/:configurationId - Crea una nueva versión de una configuración
// Recibe JSON con: field, value y token
router.put('/update/:configurationId', configController.updateConfig);

// DELETE /api/config/:configurationId - Borra lógicamente una configuración
// Recibe JSON con: token
router.delete('/:configurationId', configController.deleteConfig);

module.exports = router;
