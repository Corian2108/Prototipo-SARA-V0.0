# Documentación Backend - Sistema SARA V0.0

## Estructura de Carpetas

```
backend/
├── src/
│   ├── config/
│   │   └── database.js          # Configuración y inicialización de BD
│   ├── controllers/
│   │   ├── authController.js    # Autenticación (setup, login, logout)
│   │   ├── sensorController.js  # Gestión de datos de sensores
│   │   ├── configController.js  # Configuración del riego
│   │   └── analyticsController.js # Estadísticas y exportación
│   ├── services/
│   │   ├── authService.js       # Lógica de autenticación y sesiones
│   │   └── riegoService.js      # Lógica de decisión de riego
│   ├── middleware/
│   │   ├── authMiddleware.js    # Verificación de tokens
│   │   └── validators.js        # Validación de datos
│   └── routes/
│       ├── authRoutes.js        # Rutas de autenticación
│       ├── sensorRoutes.js      # Rutas de sensores
│       ├── configRoutes.js      # Rutas de configuración
│       └── analyticsRoutes.js   # Rutas de análisis
├── server.js                     # Aplicación Express principal
├── package.json                  # Dependencias del proyecto
└── database.db                   # Base de datos SQLite
```

---

## Archivos de Configuración

### database.js (src/config/database.js)
Inicializa la conexión a SQLite y crea las tablas necesarias.

**Tablas:**
- `usuarios`: id, usuario (único), contraseña encriptada
- `sesiones`: id, usuario_id, token, activa, fecha_ingreso, fecha_cierre
- `lecturas`: id, humedad, temperatura, humedad_ambiente, bomba_activada, fecha
- `configuracion_riego`: id, maceta_id, humedad_minima, humedad_objetivo, etc.

---

## Servicios (Business Logic)

### authService.js (src/services/authService.js)

**Funciones:**

1. **hashPassword(password)**
   - Encripta contraseña con bcrypt (salt=10)
   - Entrada: string contraseña
   - Salida: Promise<string> hash encriptado

2. **verifyPassword(password, hash)**
   - Verifica contraseña contra su hash
   - Entrada: string password, string hash
   - Salida: Promise<boolean>

3. **generateToken()**
   - Genera token único de sesión
   - Entrada: ninguna
   - Salida: string token hexadecimal de 64 caracteres

4. **checkIfSetup()**
   - Verifica si el sistema ya tiene usuario configurado
   - Entrada: ninguna
   - Salida: Promise<boolean>

5. **checkActiveSessions()**
   - Verifica si hay sesiones activas
   - Entrada: ninguna
   - Salida: Promise<boolean>

6. **setupUser(usuario, contrasena)**
   - Crea primer usuario del sistema
   - Entrada: usuario (string), contrasena (string)
   - Salida: Promise<{id: number}>

7. **loginUser(usuario, contrasena)**
   - Autentica usuario y crea sesión
   - Entrada: usuario (string), contrasena (string)
   - Salida: Promise<{token, usuario, usuarioId}>
   - Rechaza: si usuario no existe o contraseña incorrecta

8. **verifyToken(token)**
   - Valida token de sesión
   - Entrada: token (string)
   - Salida: Promise<object> datos de sesión
   - Rechaza: si token inválido o sesión expirada

9. **logoutUser(token)**
   - Cierra sesión marcándola inactiva
   - Entrada: token (string)
   - Salida: Promise<{message}>

---

### riegoService.js (src/services/riegoService.js)

**Función:**

1. **evaluarRiego(humedadActual, configuracion)**
   - Decide si activar bomba de riego
   - Entrada: número humedad (0-100), objeto configuración
   - Salida: {encenderBomba: boolean, duracionMs: number, mensaje: string}
   - Lógica: si humedad < umbral mínimo, calcula duración proporcional al déficit

---

## Controladores (Endpoints)

### authController.js (src/controllers/authController.js)

1. **checkSetup(req, res)**
   - Verifica configuración del sistema
   - Respuesta: {isSetup: boolean, hasActiveSessions: boolean}

2. **setup(req, res)**
   - Configura usuario/contraseña inicial
   - Entrada: {usuario, contrasena}
   - Validaciones: usuario ≥3 chars, contraseña ≥6 chars
   - Respuesta: {message}

3. **login(req, res)**
   - Autentica usuario
   - Entrada: {usuario, contrasena}
   - Respuesta: {token, usuario, usuarioId}
   - Error 401: credenciales inválidas

4. **logout(req, res)**
   - Cierra sesión
   - Entrada: Authorization header con token
   - Respuesta: {status, message}

---

### sensorController.js (src/controllers/sensorController.js)

1. **recibirDatosSensor(req, res)**
   - Recibe datos de ESP32 y decide riego
   - Entrada: {humedad, temperatura, humedad_ambiente}
   - Salida: {encender_bomba, duracion_ms, mensaje}
   - Guarda lectura en BD y retorna decisión

2. **obtenerUltimaLectura(req, res)**
   - Retorna última lectura registrada
   - Salida: objeto lectura

3. **obtenerHistorial(req, res)**
   - Retorna lecturas de últimas N horas
   - Parámetro: ?limite=24 (horas)
   - Salida: array de lecturas

---

### configController.js (src/controllers/configController.js)

1. **obtenerConfiguracion(req, res)**
   - Retorna configuración actual
   - Salida: {humedad_minima, humedad_objetivo, riego_maximo_segundos, ...}

2. **actualizarConfiguracion(req, res)**
   - Actualiza parámetros de configuración
   - Entrada: {humedad_minima, humedad_objetivo, riego_maximo_segundos}
   - Actualiza dinámicamente solo los campos proporcionados
   - Salida: {status, message, changes}

---

### analyticsController.js (src/controllers/analyticsController.js)

1. **obtenerResumen(req, res)**
   - Estadísticas resumidas
   - Parámetro: ?dias=1
   - Salida: {humedad_promedio, humedad_minima, humedad_maxima, temperatura_promedio, ciclos_riego, total_lecturas}

2. **exportarCSV(req, res)**
   - Exporta datos en CSV
   - Parámetro: ?dias=7
   - Salida: archivo CSV descargable

---

## Middleware

### authMiddleware.js (src/middleware/authMiddleware.js)

**Función:**

1. **verificarToken(req, res, next)**
   - Middleware que protege rutas
   - Valida header: Authorization: Bearer {token}
   - Continúa si token válido, retorna 401 si no
   - Agrega req.session con datos de sesión

---

### validators.js (src/middleware/validators.js)

**Función:**

1. **validarDatosSensor(req, res, next)**
   - Valida datos de sensor
   - Validaciones: humedad 0-100%, temperatura -10 a 60°C
   - Continúa si válido, retorna 400 si no

---

## Rutas

### Rutas Públicas (sin autenticación)

**authRoutes.js**
- `GET /api/auth/check-setup` - Verifica configuración
- `POST /api/auth/setup` - Configura usuario inicial
- `POST /api/auth/login` - Inicia sesión
- `POST /api/auth/logout` - Cierra sesión

---

### Rutas Protegidas (requieren token)

**sensorRoutes.js**
- `POST /api/sensor` - Recibe datos de sensor
- `GET /api/sensor/ultimo` - Última lectura
- `GET /api/sensor/historial` - Historial (parámetro: limite)

**configRoutes.js**
- `GET /api/config` - Obtiene configuración
- `PUT /api/config` - Actualiza configuración

**analyticsRoutes.js**
- `GET /api/analytics/resumen` - Estadísticas (parámetro: dias)
- `GET /api/analytics/exportar-csv` - Exporta CSV (parámetro: dias)

---

## Server Principal (server.js)

Configuración de Express:
- CORS habilitado
- JSON parsing
- Logging de requests
- Rutas públicas y protegidas separadas
- Health check en `/health`
- Información de API en `/`

---

## Flujo de Autenticación

1. **Primera vez**: GET `/api/auth/check-setup` → isSetup: false
2. **Setup**: POST `/api/auth/setup` → usuario y contraseña guardados (encriptados)
3. **Login**: POST `/api/auth/login` → recibe token
4. **Usar API**: Enviar `Authorization: Bearer {token}` en headers
5. **Logout**: POST `/api/auth/logout` → sesión cerrada

---

## Variables de Entorno

- `PORT`: Puerto del servidor (default 3000)
- `CORS_ORIGINS`: Orígenes permitidos CORS (default localhost:5500)
- `DB_PATH`: Ruta de la BD SQLite (default ./database.db)

---

## Dependencias

- `express`: Framework web
- `cors`: Manejo de CORS
- `sqlite3`: Base de datos
- `bcrypt`: Encriptación de contraseñas
- `dotenv`: Gestión de variables de entorno

---

## Patrones Utilizados

1. **Patrón MVC**: Models (BD), Views (JSON), Controllers (lógica)
2. **Separation of Concerns**: Services para lógica, Controllers para HTTP
3. **Middleware**: Autenticación y validación
4. **Promises**: Operaciones async
5. **Error Handling**: Try-catch y status codes HTTP apropiados

---

## Seguridad

- ✅ Contraseñas encriptadas con bcrypt
- ✅ Tokens únicos de sesión
- ✅ Middleware de autenticación para rutas protegidas
- ✅ Validación de entrada de datos
- ✅ CORS configurado
- ✅ Sesiones registradas en BD

---

## Testing de Endpoints

### Setup y Login

```bash
# Verificar estado
curl http://localhost:3000/api/auth/check-setup

# Configurar primer usuario
curl -X POST http://localhost:3000/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"usuario": "admin", "contrasena": "admin123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usuario": "admin", "contrasena": "admin123"}'

# Guardar el token retornado
TOKEN="eyJXXX..."

# Usar API protegida
curl http://localhost:3000/api/config \
  -H "Authorization: Bearer $TOKEN"

# Logout
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

---

## Notas de Desarrollo

- La BD se crea automáticamente al iniciar
- Los controladores usan callbacks de sqlite3 (no async/await)
- Los servicios de auth usan Promises para mejorar legibilidad
- Todos los errores se registran en consola para debugging
