const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

// GET /api/analytics/resumen - Obtiene estadísticas resumidas (parámetro: dias)
router.get('/resumen', analyticsController.obtenerResumen);

// GET /api/analytics/exportar-csv - Exporta datos en formato CSV (parámetro: dias)
router.get('/exportar-csv', analyticsController.exportarCSV);

module.exports = router;
