const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');

// POST /api/sensor - Recibe y procesa datos de sensores del ESP32
router.post('/', sensorController.recibirMedicion);

// GET /api/sensor/ultimo - Obtiene la última lectura registrada
router.get('/estadisticas', sensorController.obtenerEstadisticasCiclos);

// GET /api/sensor/historial - Obtiene historial de lecturas (parámetro: limite en horas)
router.get('/historial', sensorController.obtenerHistorialCiclos);

module.exports = router;
