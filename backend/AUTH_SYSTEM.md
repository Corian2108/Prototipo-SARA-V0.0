# Sistema de Autenticación - SARA V0.0

## Descripción General

Se implementó una capa de seguridad básica con autenticación simple basada en sesiones. El sistema incluye:

1. **Tabla de usuarios**: Almacena usuario y contraseña encriptada (bcrypt)
2. **Tabla de sesiones**: Registra cada ingreso con fecha y token
3. **Middleware de autenticación**: Protege las rutas del API

## Flujo de Uso

### 1. **Primer acceso (Setup)**

Cuando el sistema se inicia por primera vez:

```bash
GET /api/auth/check-setup
```

Respuesta:
```json
{
  "isSetup": false,
  "hasActiveSessions": false
}
```

Luego, configurar usuario y contraseña:

```bash
POST /api/auth/setup
Content-Type: application/json

{
  "usuario": "admin",
  "contrasena": "micontraseña123"
}
```

Respuesta:
```json
{
  "message": "Usuario configurado exitosamente"
}
```

### 2. **Login**

Una vez configurado, el usuario debe iniciar sesión:

```bash
POST /api/auth/login
Content-Type: application/json

{
  "usuario": "admin",
  "contrasena": "micontraseña123"
}
```

Respuesta:
```json
{
  "status": "ok",
  "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "usuario": "admin",
  "usuarioId": 1
}
```

### 3. **Usar endpoints protegidos**

El token debe enviarse en el header `Authorization`:

```bash
GET /api/sensor/ultimo
Authorization: Bearer a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### 4. **Logout**

Para cerrar sesión:

```bash
POST /api/auth/logout
Authorization: Bearer a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

Respuesta:
```json
{
  "status": "ok",
  "message": "Sesión cerrada exitosamente"
}
```

## Endpoints Públicos

- `GET /api/auth/check-setup` - Verificar si está configurado y si hay sesiones activas
- `POST /api/auth/setup` - Configurar usuario y contraseña (solo disponible si no está configurado)
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/logout` - Cerrar sesión

## Endpoints Protegidos

Todos los siguientes endpoints requieren enviar el token en el header `Authorization: Bearer {token}`:

- `POST /api/sensor` - Recibir datos del ESP32
- `GET /api/sensor/ultimo` - Última lectura
- `GET /api/sensor/historial` - Historial
- `GET /api/config` - Configuración actual
- `PUT /api/config` - Actualizar configuración
- `GET /api/analytics/resumen` - Estadísticas
- `GET /api/analytics/exportar-csv` - Exportar datos

## Base de Datos

### Tabla: usuarios

```sql
CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario TEXT UNIQUE NOT NULL,
  contrasena TEXT NOT NULL,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME
)
```

### Tabla: sesiones

```sql
CREATE TABLE sesiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  fecha_ingreso DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_cierre DATETIME,
  activa BOOLEAN DEFAULT 1,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
)
```

## Archivos Creados

1. **backend/src/services/authService.js**
   - Funciones de hashing de contraseña (bcrypt)
   - Generación de tokens
   - Verificación de configuración
   - Gestión de login/logout

2. **backend/src/controllers/authController.js**
   - Endpoints: setup, login, logout, checkSetup
   - Validaciones de entrada
   - Manejo de errores

3. **backend/src/routes/authRoutes.js**
   - Definición de rutas públicas de autenticación

4. **backend/src/middleware/authMiddleware.js**
   - Middleware `verificarToken` para proteger rutas
   - Validación de tokens y sesiones activas

5. **backend/server.js** (actualizado)
   - Importación de authRoutes
   - Aplicación de middleware a rutas protegidas

6. **backend/src/config/database.js** (actualizado)
   - Creación de tablas usuarios y sesiones

## Seguridad

- **Contraseñas encriptadas**: Usa bcrypt con salt de 10 rondas
- **Tokens únicos**: Genera tokens aleatorios de 64 caracteres hexadecimales
- **Sesiones activas**: Solo sesiones marcadas como activas son válidas
- **Fecha de ingreso**: Cada sesión registra cuándo se inició
- **Validaciones**: Longitud mínima de usuario (3 chars) y contraseña (6 chars)

## Mejoras Futuras

- Agregar JWT tokens con expiración
- Implementar refresh tokens
- Agregar 2FA (autenticación de dos factores)
- Auditoría de intentos fallidos de login
- Roles y permisos granulares
