const configService = require('../services/configService');

// Obtiene todo el historial de configuraciones de riego
// Entrada: ninguna
// Salida: JSON con el listado completo de configuraciones
const getConfigHistory = async (req, res) => {
    try {
        const configs = await configService.getConfigHistory();
        return res.json(configs);
    } catch (error) {
        console.error('Error al obtener historial de configuraciones:', error);
        return res.status(500).json({ error: 'Error al obtener historial de configuraciones' });
    }
};

// Obtiene únicamente las configuraciones activas
// Entrada: ninguna
// Salida: JSON con las configuraciones cuyo StateId = 1
const getConfigActive = async (req, res) => {
    try {
        const configs = await configService.getConfigActive();
        return res.json(configs);
    } catch (error) {
        console.error('Error al obtener configuraciones activas:', error);
        return res.status(500).json({ error: 'Error al obtener configuraciones activas' });
    }
};

// Crea una nueva configuración de riego
// Entrada: JSON con growthStage, plant, minHumidity, objHumidity, timeBetweenCycles (opcional),
// timeBetweenMeasurements (opcional, por defecto 10), irrigationDescription y token
// Salida: JSON con el identificador de la nueva configuración creada
const addConfig = async (req, res) => {
    try {
        const payload = req.body || {};
        const token = payload.token || req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Token requerido' });
        }

        const result = await configService.addConfig({ ...payload, token });
        return res.status(201).json(result);
    } catch (error) {
        console.error('Error al crear configuración:', error);
        return res.status(400).json({ error: error.message || 'Error al crear configuración' });
    }
};

// Actualiza una configuración existente creando una nueva versión
// Entrada: params.configurationId, body.field, body.value y body.token
// Salida: JSON con la nueva configuración creada y la anterior marcada como inactiva
const updateConfig = async (req, res) => {
    try {
        const configurationId = Number(req.params.configurationId);
        const { field, value, token } = req.body || {};
        const authToken = token || req.headers.authorization?.split(' ')[1];

        if (!configurationId || !field || value === undefined || !authToken) {
            return res.status(400).json({ error: 'Se requieren configurationId, field, value y token' });
        }

        const result = await configService.updateConfig(configurationId, field, value, authToken);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error al actualizar configuración:', error);
        return res.status(400).json({ error: error.message || 'Error al actualizar configuración' });
    }
};

// Elimina lógicamente una configuración cambiando su estado a 3
// Entrada: params.configurationId y body.token
// Salida: JSON indicando que la configuración fue marcada como eliminada
const deleteConfig = async (req, res) => {
    try {
        const configurationId = Number(req.params.configurationId);
        const { token } = req.body || {};
        const authToken = token || req.headers.authorization?.split(' ')[1];

        if (!configurationId || !authToken) {
            return res.status(400).json({ error: 'Se requieren configurationId y token' });
        }

        const result = await configService.deleteConfig(configurationId, authToken);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error al eliminar configuración:', error);
        return res.status(400).json({ error: error.message || 'Error al eliminar configuración' });
    }
};

module.exports = {
    getConfigHistory,
    getConfigActive,
    addConfig,
    updateConfig,
    deleteConfig
};
