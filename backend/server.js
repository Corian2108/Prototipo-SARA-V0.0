require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Importar rutas
const authRoutes = require('./src/routes/authRoutes');
const sensorRoutes = require('./src/routes/sensorRoutes');
const configRoutes = require('./src/routes/configRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes');

// Importar middleware
const { verificarToken } = require('./src/middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar middleware CORS - permite solicitudes del frontend
const corsOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:5500'];
app.use(cors({
    origin: corsOrigins,
    credentials: true
}));

// Middleware para parsear JSON en las solicitudes
app.use(express.json());

// Servir archivos estáticos
app.use(express.static('public'));

// Logging de requests - útil para debugging y monitoreo
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Rutas públicas - sin requerir autenticación
app.use('/api/auth', authRoutes);

// Rutas protegidas - requieren token válido en header Authorization
app.use('/api/sensor', verificarToken, sensorRoutes);
app.use('/api/config', verificarToken, configRoutes);
app.use('/api/analytics', verificarToken, analyticsRoutes);

// Ruta de salud (health check) - verifica que el servidor está funcionando
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Ruta raíz - información general de la API
app.get('/', (req, res) => {
    res.json({
        name: 'API Riego Inteligente',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            sensor: '/api/sensor',
            config: '/api/config',
            analytics: '/api/analytics'
        }
    });
});

// Iniciar servidor en el puerto especificado
app.listen(PORT, () => {
    console.log(`
    🚀 Servidor corriendo en: http://localhost:${PORT}
    📡 Endpoints disponibles:
        POST   /api/auth/setup       - Configurar usuario y contraseña inicial
        GET    /api/auth/check-setup - Verificar si está configurado
        POST   /api/auth/login       - Iniciar sesión
        POST   /api/auth/logout      - Cerrar sesión
        POST   /api/sensor           - Recibir datos del ESP32 (protegido)
        GET    /api/sensor/ultimo    - Última lectura (protegido)
        GET    /api/sensor/historial - Historial (protegido)
        GET    /api/config           - Configuración actual (protegido)
        PUT    /api/config           - Actualizar configuración (protegido)
        GET    /api/analytics/resumen - Estadísticas (protegido)
        GET    /api/analytics/exportar-csv - Exportar datos (protegido)
    `);
});
