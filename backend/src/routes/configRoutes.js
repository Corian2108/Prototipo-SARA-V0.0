const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');

router.get('/', configController.obtenerConfiguracion);
router.put('/', configController.actualizarConfiguracion);

module.exports = router;