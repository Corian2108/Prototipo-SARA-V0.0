const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../config/database');
const { validarUsername, validarPassword } = require('../middleware/validators');

// Encripta una contraseña usando bcrypt
// Entrada: password (string) - contraseña sin encriptar
// Salida: Promise<string> - contraseña encriptada
const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
};

// Verifica si una contraseña coincide con su hash encriptado
// Entrada: password (string) - contraseña sin encriptar, hash (string) - hash almacenado
// Salida: Promise<boolean> - true si coincide, false si no
const verifyPassword = async (password, hash) => {
    return bcrypt.compare(password, hash);
};

// Genera un token único aleatorio para la sesión
// Entrada: ninguna
// Salida: string - token de 64 caracteres hexadecimales
const generateToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Valida el nombre de usuario
// Entrada: username (string)
// Salida: void - lanza error si es inválido
const validateUsername = (username) => {
    const result = validarUsername(username);
    if (!result.valid) {
        throw new Error(result.error);
    }
};

// Valida la contraseña
// Entrada: password (string)
// Salida: void - lanza error si es inválida
const validatePassword = (password) => {
    const result = validarPassword(password);
    if (!result.valid) {
        throw new Error(result.error);
    }
};

// Verifica si el sistema ya ha sido configurado (existe al menos un usuario)
// Entrada: ninguna
// Salida: Promise<boolean> - true si existe usuario, false si no
const checkIfSetup = () => {
    return new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) as count FROM User`, (err, row) => {
            if (err) reject(err);
            resolve(row && row.count > 0);
        });
    });
};

// Verifica si existe un token de sesión activo en el sistema
// Entrada: token (string) - token a validar
// Salida: Promise<boolean> - true si existe sesión activa con ese token, false si no
const checkActiveSessions = (token) => {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT COUNT(*) as count FROM Sesion WHERE Active = 1 AND Token = ?`,
            [token],
            (err, row) => {
                if (err) reject(err);
                resolve(row && row.count > 0);
            }
        );
    });
};

// Crea un nuevo usuario con su contraseña encriptada en la base de datos
// Entrada: username (string) - nombre de usuario, password (string) - contraseña sin encriptar
// Salida: Promise<{id: number}> - ID del usuario creado con estado Activo (StateId=1)
// Validaciones: aplica validarUsername y validarPassword
const setupUser = async (username, password) => {
    // Validar username y password
    validateUsername(username);
    validatePassword(password);

    const hashedPassword = await hashPassword(password);

    return new Promise((resolve, reject) => {
        // Insertar usuario con estado Activo (StateId=1)
        db.run(
            `INSERT INTO User (UserName, Secret, StateId) VALUES (?, ?, 1)`,
            [username, hashedPassword],
            function (err) {
                if (err) reject(err);
                resolve({ id: this.lastID });
            }
        );
    });
};

// Autentica un usuario y crea una nueva sesión
// Entrada: username (string), password (string), ip (string, opcional)
// Salida: Promise<{token, username, userId}> - token, username y ID del usuario
// Rechaza: si el usuario no existe, contraseña es incorrecta, o usuario está bloqueado
const loginUser = async (username, password, ip = 'unknown') => {
    return new Promise(async (resolve, reject) => {
        // Obtener usuario con su estado
        db.get(
            `SELECT UserId, UserName, Secret, StateId FROM User WHERE UserName = ?`,
            [username],
            async (err, user) => {
                if (err) return reject(err);

                // Usuario no existe
                if (!user) {
                    return reject(new Error('Usuario o contraseña incorrectos'));
                }

                // Verificar si usuario está bloqueado (StateId = 2)
                if (user.StateId === 2) {
                    const error = new Error('Usuario bloqueado');
                    error.blocked = true;
                    return reject(error);
                }

                // Verificar contraseña
                const passwordValid = await verifyPassword(password, user.Secret);
                if (!passwordValid) {
                    return reject(new Error('Usuario o contraseña incorrectos'));
                }

                // Contraseña correcta: desactivar sesiones previas
                db.run(
                    `UPDATE Sesion SET Active = 0 WHERE UserId = ? AND Active = 1`,
                    [user.UserId],
                    async (err) => {
                        if (err) return reject(err);

                        // Generar token y crear nueva sesión
                        const token = generateToken();
                        const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

                        db.run(
                            `INSERT INTO Sesion (UserId, Token, IP, Active, Timestamp) VALUES (?, ?, ?, 1, ?)`,
                            [user.UserId, token, ip, timestamp],
                            function (err) {
                                if (err) return reject(err);
                                resolve({
                                    token,
                                    username: user.UserName,
                                    userId: user.UserId
                                });
                            }
                        );
                    }
                );
            }
        );
    });
};

// Verifica si un token de sesión es válido y activo
// Entrada: token (string) - token de sesión a validar
// Salida: Promise<object> - datos de la sesión si es válida (SesionId, UserId, Token, Active, etc.)
// Rechaza: si el token es inválido o la sesión está inactiva
const verifyToken = (token) => {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT SesionId, UserId, Token, Active, IP, Timestamp FROM Sesion WHERE Token = ? AND Active = 1`,
            [token],
            (err, session) => {
                if (err) return reject(err);
                if (!session) {
                    return reject(new Error('Sesión inválida o expirada'));
                }
                resolve(session);
            }
        );
    });
};

// Cierra una sesión marcándola como inactiva
// Entrada: token (string) - token de la sesión a cerrar
// Salida: Promise<{message}> - mensaje de confirmación
const logoutUser = (token) => {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE Sesion SET Active = 0 WHERE Token = ?`,
            [token],
            function (err) {
                if (err) return reject(err);
                resolve({ message: 'Sesión cerrada' });
            }
        );
    });
};

// Bloquea un usuario por ID (usado cuando se agoten los intentos de login)
// Entrada: userId (number)
// Salida: Promise<{message}> - mensaje de confirmación
// Operación: Desactiva todas las sesiones activas y pone estado bloqueado (StateId=2)
const blockUser = (userId) => {
    return new Promise((resolve, reject) => {
        // Primero desactivar todas las sesiones activas
        db.run(
            `UPDATE Sesion SET Active = 0 WHERE UserId = ? AND Active = 1`,
            [userId],
            (err) => {
                if (err) return reject(err);

                // Luego cambiar estado del usuario a bloqueado (StateId=2)
                db.run(
                    `UPDATE User SET StateId = 2 WHERE UserId = ?`,
                    [userId],
                    function (err) {
                        if (err) return reject(err);
                        resolve({ message: 'Usuario bloqueado' });
                    }
                );
            }
        );
    });
};

module.exports = {
    hashPassword,
    verifyPassword,
    generateToken,
    validateUsername,
    validatePassword,
    checkIfSetup,
    checkActiveSessions,
    setupUser,
    loginUser,
    verifyToken,
    logoutUser,
    blockUser
};
