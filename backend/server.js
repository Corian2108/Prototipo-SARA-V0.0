require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Importar rutas
const sensorRoutes = require('./src/routes/sensorRoutes');
const configRoutes = require('./src/routes/configRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const corsOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:5500'];
app.use(cors({
    origin: corsOrigins,
    credentials: true
}));
app.use(express.json());
app.use(express.static('public')); // Para archivos estáticos si los tienes

// Logging de requests (útil para debugging)
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Rutas
app.use('/api/sensor', sensorRoutes);
app.use('/api/config', configRoutes);
app.use('/api/analytics', analyticsRoutes);

// Ruta de salud (health check)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Ruta raíz (opcional, para verificar que el servidor funciona)
app.get('/', (req, res) => {
    res.json({
        name: 'API Riego Inteligente',
        version: '1.0.0',
        endpoints: {
            sensor: '/api/sensor',
            config: '/api/config',
            analytics: '/api/analytics'
        }
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`
    🚀 Servidor corriendo en: http://localhost:${PORT}
    📡 Endpoints disponibles:
        POST   /api/sensor         - Recibir datos del ESP32
        GET    /api/sensor/ultimo  - Última lectura
        GET    /api/sensor/historial - Historial
        GET    /api/config         - Configuración actual
        PUT    /api/config         - Actualizar configuración
        GET    /api/analytics/resumen - Estadísticas
        GET    /api/analytics/exportar-csv - Exportar datos
    `);
});