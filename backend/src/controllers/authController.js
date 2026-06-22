const authService = require('../services/authService');

// Verifica si el sistema está configurado y si hay sesiones activas
// Entrada: ninguna (POST request), opcionalmente token en body
// Salida: JSON {isSetup: boolean, hasActiveSessions: boolean}
const checkSetup = async (req, res) => {
    try {
        let hasActiveSessions = false;

        const { token } = req.body;
        const isSetup = await authService.checkIfSetup();

        if (token) {
            hasActiveSessions = await authService.checkActiveSessions(token);
        }

        res.json({ isSetup, hasActiveSessions });
    } catch (error) {
        console.error('Error en checkSetup:', error);
        res.status(500).json({ error: 'Error al verificar configuración' });
    }
};

// Configura el usuario y contraseña inicial del sistema
// Entrada: JSON {usuario: string, contrasena: string}
// Salida: JSON {message: string} si éxito, error si falla
// Validaciones: usuario 6-20 chars sin tildes/ñ, contraseña 8+ sin tildes, sistema no debe estar configurado
const setup = async (req, res) => {
    try {
        const { usuario, contrasena } = req.body;

        if (!usuario || !contrasena) {
            return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
        }

        const isSetup = await authService.checkIfSetup();
        if (isSetup) {
            return res.status(403).json({ error: 'El sistema ya está configurado' });
        }

        await authService.setupUser(usuario, contrasena);
        res.json({ message: 'Usuario configurado exitosamente' });
    } catch (error) {
        console.error('Error en setup:', error);
        // Los errores de validación vienen del validarUsername/validarPassword
        res.status(400).json({ error: error.message });
    }
};

// Autentica un usuario y crea una nueva sesión
// Entrada: JSON {usuario: string, contrasena: string}
// Salida: JSON {status, token, usuario, usuarioId} si éxito, error si falla
// Retorna: token null si credenciales inválidas, error.blocked=true si usuario bloqueado
const login = async (req, res) => {
    try {
        const { usuario, contrasena } = req.body;

        if (!usuario || !contrasena) {
            return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
        }

        const result = await authService.loginUser(usuario, contrasena);
        res.json({
            status: 'ok',
            token: result.token,
            usuario: result.username,
            usuarioId: result.userId
        });
    } catch (error) {
        console.error('Error en login:', error);

        // Detectar si el usuario está bloqueado
        if (error.blocked) {
            return res.status(403).json({
                error: error.message,
                blocked: true
            });
        }

        // Credenciales inválidas
        res.status(401).json({ error: error.message });
    }
};

// Cierra la sesión actual del usuario
// Entrada: token en header Authorization: Bearer {token}
// Salida: JSON {status, message} si éxito, error si falla
const logout = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(400).json({ error: 'Token requerido' });
        }

        await authService.logoutUser(token);
        res.json({ status: 'ok', message: 'Sesión cerrada exitosamente' });
    } catch (error) {
        console.error('Error en logout:', error);
        res.status(500).json({ error: 'Error al cerrar sesión' });
    }
};

module.exports = {
    checkSetup,
    setup,
    login,
    logout
};
