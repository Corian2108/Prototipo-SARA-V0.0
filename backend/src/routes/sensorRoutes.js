const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');

router.post('/', sensorController.recibirDatosSensor);
router.get('/ultimo', sensorController.obtenerUltimaLectura);
router.get('/historial', sensorController.obtenerHistorial);

module.exports = router;