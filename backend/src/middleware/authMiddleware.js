const authService = require('../services/authService');

// Middleware que verifica si el token enviado en el header Authorization es válido
// Entrada: Authorization header en formato "Bearer {token}"
// Salida: Si es válido, continúa a siguiente middleware. Si no, retorna error 401
// Función: Protege rutas para que solo usuarios autenticados puedan acceder
const verificarToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Token requerido' });
        }

        const session = await authService.verifyToken(token);
        req.session = session;
        next();
    } catch (error) {
        console.error('Error en verificarToken:', error);
        res.status(401).json({ error: 'Token inválido o expirado' });
    }
};

module.exports = { verificarToken };
