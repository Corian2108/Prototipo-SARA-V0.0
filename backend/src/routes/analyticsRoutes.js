const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

router.get('/resumen', analyticsController.obtenerResumen);
router.get('/exportar-csv', analyticsController.exportarCSV);

module.exports = router;