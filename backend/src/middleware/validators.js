// Middleware que valida que los datos del sensor tengan valores dentro de rangos aceptables
// Entrada: humedad (0-100), temperatura (-10 a 60)
// Salida: Continúa al siguiente middleware si es válido, si no retorna error 400
// Validaciones: humedad entre 0-100%, temperatura entre -10°C y 60°C
const validarDatosSensor = (req, res, next) => {
    const { humedad, temperatura } = req.body;

    // Verificar que los datos requeridos estén presentes
    if (humedad === undefined || temperatura === undefined) {
        return res.status(400).json({
            error: 'Datos incompletos',
            required: ['humedad', 'temperatura'],
            received: Object.keys(req.body)
        });
    }

    // Validar rango de humedad (0-100%)
    if (humedad < 0 || humedad > 100) {
        return res.status(400).json({ error: 'Humedad debe estar entre 0 y 100' });
    }

    // Validar rango de temperatura (-10°C a 60°C)
    if (temperatura < -10 || temperatura > 60) {
        return res.status(400).json({ error: 'Temperatura fuera de rango válido' });
    }

    // Si todas las validaciones pasaron, continuar al siguiente middleware/controlador
    next();
};

// Valida el formato del nombre de usuario
// Entrada: username (string)
// Salida: { valid: boolean, error?: string }
// Validaciones: 6-20 caracteres, solo alfanuméricos y guiones bajos, sin tildes ni ñ
const validarUsername = (username) => {
    if (!username || typeof username !== 'string') {
        return { valid: false, error: 'Usuario requerido' };
    }

    if (username.length < 6) {
        return { valid: false, error: 'Usuario debe tener al menos 6 caracteres' };
    }

    if (username.length > 20) {
        return { valid: false, error: 'Usuario no puede exceder 20 caracteres' };
    }

    // Solo alfanuméricos y guiones bajos (sin tildes, ñ, espacios, caracteres especiales)
    const regexUsername = /^[a-zA-Z0-9_]{6,20}$/;
    if (!regexUsername.test(username)) {
        return { valid: false, error: 'Usuario solo puede contener letras, números y guiones bajos (sin tildes ni caracteres especiales)' };
    }

    return { valid: true };
};

// Valida el formato de la contraseña
// Entrada: password (string)
// Salida: { valid: boolean, error?: string }
// Validaciones: 8+ caracteres, sin tildes ni ñ, permite . - _ @
const validarPassword = (password) => {
    if (!password || typeof password !== 'string') {
        return { valid: false, error: 'Contraseña requerida' };
    }

    if (password.length < 8) {
        return { valid: false, error: 'Contraseña debe tener al menos 8 caracteres' };
    }

    // Sin tildes ni ñ, pero permite . - _ @
    const regexPassword = /^[a-zA-Z0-9._@\-]{8,}$/;
    if (!regexPassword.test(password)) {
        return { valid: false, error: 'Contraseña contiene caracteres no permitidos. Solo se permiten: letras, números, puntos, guiones, guiones bajos y @' };
    }

    return { valid: true };
};

module.exports = { validarDatosSensor, validarUsername, validarPassword };
