/* ============================================================================
 * database.js
 * ----------------------------------------------------------------------------
 * Script de inicialización de la base de datos SQLite para el modelo
 * "SARA Irrigation Model".
 *
 * QUÉ HACE:
 *   - Crea (si no existe) el archivo de base de datos SQLite dentro de la
 *     carpeta /data del proyecto.
 *   - Crea automáticamente todas las tablas, columnas y relaciones (claves
 *     foráneas) descritas en el diagrama entidad-relación, usando
 *     "CREATE TABLE IF NOT EXISTS" para que el proceso sea idempotente
 *     (no falla ni duplica nada si la base de datos ya existe).
 *   - Habilita la verificación de llaves foráneas (PRAGMA foreign_keys = ON).
 *
 * CÓMO SE EJECUTA AUTOMÁTICAMENTE AL ARRANCAR EL PROYECTO (Next.js):
 *   - App Router: importa este archivo una sola vez dentro de
 *     "instrumentation.js" (hook oficial de Next.js que se ejecuta al
 *     levantar el servidor):
 *
 *         // instrumentation.js
 *         export async function register() {
 *           if (process.env.NEXT_RUNTIME === 'nodejs') {
 *             require('./database');
 *           }
 *         }
 *
 *   - Pages Router / API Routes: basta con requerirlo una vez desde
 *     cualquier API route que se use al iniciar, por ejemplo:
 *
 *         // pages/api/_init.js  o dentro de pages/_app.js (solo en server)
 *         require('../../database');
 *
 *   - También puede ejecutarse de forma manual / como script de arranque:
 *         node database.js
 *
 * CONVENCIONES APLICADAS:
 *   - Todo campo "Id" / "*Id" que sea llave primaria es INTEGER PRIMARY KEY
 *     AUTOINCREMENT (único tipo de columna que SQLite permite autoincrementar
 *     de forma nativa).
 *   - Todo campo de fecha/hora se almacena como TEXT con el formato
 *     'YYYY-MM-DD HH:MM:SS' (formato estándar de SQLite con la función
 *     strftime, ej: 2026-06-20 14:35:02).
 *   - Los nombres de tablas y columnas respetan exactamente la nomenclatura
 *     del diagrama original (incluyendo pequeñas inconsistencias de
 *     tipeo como "ObjectiveHumidity", "TimeBetweenCycles" o
 *     "SoilMoisture"), para que el esquema generado sea 100% trazable al
 *     diagrama fuente.
 * ============================================================================ */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

/* ----------------------------------------------------------------------------
 * Ubicación física del archivo de base de datos.
 * Se guarda en <raíz_del_proyecto>/data/sara_irrigation.db
 * -------------------------------------------------------------------------- */
const DB_DIR = path.join(process.cwd(), process.env.DB_DIR || 'src/data');
const DB_PATH = path.join(DB_DIR, process.env.DB_PATH || 'sara_irrigation.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const dbAlreadyExisted = fs.existsSync(DB_PATH);

/* ----------------------------------------------------------------------------
 * Reutilizar la conexión entre recargas en caliente de Next.js (modo dev),
 * para evitar abrir múltiples handles del mismo archivo .db.
 * -------------------------------------------------------------------------- */
const globalForDb = globalThis;

const db =
  globalForDb.__saraDb ||
  new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('[SARA][DB] Error al conectar con la base de datos SQLite:', err.message);
    } else {
      console.log(`[SARA][DB] Conectado a la base de datos SQLite en: ${DB_PATH}`);
    }
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__saraDb = db;
}

/* ----------------------------------------------------------------------------
 * Helper para ejecutar una sentencia SQL con manejo de errores y log.
 * -------------------------------------------------------------------------- */
function run(sql, label) {
  db.run(sql, (err) => {
    if (err) {
      console.error(`[SARA][DB] Error creando "${label}":`, err.message);
    }
  });
}

db.serialize(() => {
  run('PRAGMA foreign_keys = ON;', 'PRAGMA foreign_keys');

  /* ==========================================================================
   * TABLA: GrowthStage
   * --------------------------------------------------------------------------
   * Catálogo de etapas de crecimiento de una planta (ej: germinación,
   * crecimiento vegetativo, floración, etc.). Es referenciada tanto por
   * Flowerpot (etapa actual de la maceta) como por FlowerPotConfiguration
   * (configuración de riego asociada a una etapa específica).
   *
   * Campos:
   *   - GrowthStageId (PK, INTEGER AUTOINCREMENT): identificador único de la
   *     etapa de crecimiento.
   *   - Description (VARCHAR(150)): nombre/descripción legible de la etapa
   *     (ej: "Floración").
   * ========================================================================== */
  run(
    `CREATE TABLE IF NOT EXISTS GrowthStage (
      GrowthStageId INTEGER PRIMARY KEY AUTOINCREMENT,
      Description   VARCHAR(150)
    );`,
    'GrowthStage'
  );

  /* ==========================================================================
   * TABLA: Plant
   * --------------------------------------------------------------------------
   * Catálogo de especies/tipos de planta soportadas por el sistema.
   *
   * Campos:
   *   - PlantId (PK, INTEGER AUTOINCREMENT): identificador único de la
   *     especie/tipo de planta.
   *   - Description (VARCHAR(150)): nombre/descripción de la planta
   *     (ej: "Tomate cherry").
   * ========================================================================== */
  run(
    `CREATE TABLE IF NOT EXISTS Plant (
      PlantId     INTEGER PRIMARY KEY AUTOINCREMENT,
      Description VARCHAR(150)
    );`,
    'Plant'
  );

  /* ==========================================================================
   * TABLA: Cycles
   * --------------------------------------------------------------------------
   * Define los parámetros de un ciclo de riego/medición que luego es
   * referenciado por una Configuration (Configuration.CyclesId).
   *
   * Campos:
   *   - CycleId (PK, INTEGER AUTOINCREMENT): identificador único del ciclo.
   *   - MinimumHumidity (INTEGER): humedad mínima del suelo; por debajo de
   *     este valor el sistema debe activar el riego.
   *   - ObjectiveHumidity (INTEGER): humedad objetivo que se desea alcanzar
   *     tras regar (nombre conservado tal como aparece en el diagrama
   *     original).
   *   - TimeBetweenCycles (INTEGER): tiempo de espera entre un ciclo de
   *     riego y el siguiente (nombre conservado del diagrama original).
   *   - TimeBetweenMeasurements (INTEGER): tiempo de espera entre una
   *     medición de sensores y la siguiente dentro de un mismo ciclo.
   * ========================================================================== */
  run(
    `CREATE TABLE IF NOT EXISTS Cycles (
      CycleId                  INTEGER PRIMARY KEY AUTOINCREMENT,
      MinimumHumidity          INTEGER,
      ObjectiveHumidity        INTEGER,
      TimeBetweenCycles        INTEGER,
      TimeBetweenMeasurements  INTEGER
    );`,
    'Cycles'
  );

  /* ==========================================================================
   * TABLA: Irrigation
   * --------------------------------------------------------------------------
   * Catálogo de tipos/métodos de riego disponibles (ej: goteo, aspersión).
   * Es referenciada por Configuration.IrrigationId.
   *
   * Campos:
   *   - IrrigationId (PK, INTEGER AUTOINCREMENT): identificador único del
   *     tipo de riego.
   *   - Description (VARCHAR(50)): nombre/descripción del tipo de riego.
   * ========================================================================== */
  run(
    `CREATE TABLE IF NOT EXISTS Irrigation (
      IrrigationId INTEGER PRIMARY KEY AUTOINCREMENT,
      Description  VARCHAR(50)
    );`,
    'Irrigation'
  );

  /* ==========================================================================
   * TABLA: IrrigationStates
   * --------------------------------------------------------------------------
   * Catálogo de posibles estados de una operación de riego en un momento
   * dado (ej: "Inactivo", "Regando", "Error"). Es referenciada por
   * Measurements.IrrigationStateId.
   *
   * Campos:
   *   - Id (PK, INTEGER AUTOINCREMENT): identificador único del estado.
   *   - Description (VARCHAR(50)): nombre/descripción del estado de riego.
   * ========================================================================== */
  run(
    `CREATE TABLE IF NOT EXISTS IrrigationStates (
      Id          INTEGER PRIMARY KEY AUTOINCREMENT,
      Description VARCHAR(50)
    );`,
    'IrrigationStates'
  );

  /* ==========================================================================
   * TABLA: UserState
   * --------------------------------------------------------------------------
   * Catálogo de posibles estados de una cuenta de usuario (ej: "Activo",
   * "Bloqueado"). Es referenciada por User.StateId.
   *
   * Campos:
   *   - UserStatId (PK, INTEGER AUTOINCREMENT): identificador único del
   *     estado de usuario.
   *   - Description (VARCHAR(20)): nombre/descripción del estado.
   * ========================================================================== */
  run(
    `CREATE TABLE IF NOT EXISTS UserState (
      UserStatId  INTEGER PRIMARY KEY AUTOINCREMENT,
      Description VARCHAR(20)
    );`,
    'UserState'
  );

  /* ==========================================================================
   * TABLA: User
   * --------------------------------------------------------------------------
   * Usuarios del sistema (dueños/operadores de las macetas).
   *
   * Campos:
   *   - UserId (PK, INTEGER AUTOINCREMENT): identificador único del usuario.
   *   - UserName (VARCHAR(20)): nombre de usuario utilizado para iniciar
   *     sesión.
   *   - Secret (VARCHAR(250)): credencial secreta del usuario (hash de la
   *     contraseña u otro secreto de autenticación). Nunca debe
   *     almacenarse en texto plano.
   *   - StateId (FK -> UserState.UserStatId, INTEGER): estado actual de la
   *     cuenta del usuario.
   * ========================================================================== */
  run(
    `CREATE TABLE IF NOT EXISTS User (
      UserId    INTEGER PRIMARY KEY AUTOINCREMENT,
      UserName  VARCHAR(20),
      Secret    VARCHAR(250),
      StateId   INTEGER,
      FOREIGN KEY (StateId) REFERENCES UserState (UserStatId)
    );`,
    'User'
  );

  /* ==========================================================================
   * TABLA: Sesion
   * --------------------------------------------------------------------------
   * Sesiones activas/históricas de inicio de sesión de un usuario, también
   * usadas para asociar una maceta (Flowerpot) y una configuración
   * (Configuration) al usuario que las controla.
   *
   * Campos:
   *   - SesionId (PK, INTEGER AUTOINCREMENT): identificador único de la
   *     sesión.
   *   - Timestamp (DATETIME, formato 'YYYY-MM-DD HH:MM:SS'): fecha y hora
   *     en que se creó la sesión. Por defecto toma la fecha/hora actual.
   *   - Token (NVARCHAR(250)): token de autenticación/sesión emitido al
   *     usuario.
   *   - IP (VARCHAR(20)): dirección IP desde la que se originó la sesión.
   *   - UserId (FK -> User.UserId, INTEGER): usuario dueño de la sesión.
   * ========================================================================== */
  run(
    `CREATE TABLE IF NOT EXISTS Sesion (
      SesionId  INTEGER PRIMARY KEY AUTOINCREMENT,
      Timestamp DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now')),
      Token     NVARCHAR(250),
      IP        VARCHAR(20),
      UserId    INTEGER,
      Active    BOOLEAN DEFAULT 1,
      FOREIGN KEY (UserId) REFERENCES User (UserId)
    );`,
    'Sesion'
  );
  
  /* ==========================================================================
   * TABLA: ConfigurationState
   * --------------------------------------------------------------------------
   * Catálogo de posibles estados de una configuración (ej: "Activa",
   * "Inactiva"). Es referenciada por Configuration.StateId.
   *
   * Campos:
   *   - ConfigStatId (PK, INTEGER AUTOINCREMENT): identificador único del
   *     estado de configuración.
   *   - Description (VARCHAR(20)): nombre/descripción del estado.
   * ========================================================================== */
  run(
    `CREATE TABLE IF NOT EXISTS ConfigurationState (
      ConfigStateId  INTEGER PRIMARY KEY AUTOINCREMENT,
      Description VARCHAR(50)
    );`,
    'ConfigurationState'
  );


  /* ==========================================================================
   * TABLA: Configuration
   * --------------------------------------------------------------------------
   * Configuración concreta de riego: combina un tipo de riego (Irrigation),
   * un ciclo de parámetros (Cycles) y la sesión/usuario que la definió.
   * Es referenciada por FlowerPotConfiguration y por Measurements.
   *
   * Campos:
   *   - ConfigurationId (PK, INTEGER AUTOINCREMENT): identificador único de
   *     la configuración.
   *   - IrrigationId (FK -> Irrigation.IrrigationId, INTEGER): tipo de
   *     riego utilizado en esta configuración.
   *   - CyclesId (FK -> Cycles.CycleId, INTEGER): parámetros de ciclo
   *     (humedad mínima/objetivo, tiempos) usados en esta configuración.
   *   - SesionId (FK -> Sesion.SesionId, INTEGER): sesión/usuario que creó
   *     o es propietario de esta configuración.
   * ========================================================================== */
  run(
    `CREATE TABLE IF NOT EXISTS Configuration (
      ConfigurationId INTEGER PRIMARY KEY AUTOINCREMENT,
      IrrigationId    INTEGER,
      CyclesId        INTEGER,
      SesionId        INTEGER,
      StateId         INTEGER DEFAULT 1,
      FOREIGN KEY (IrrigationId) REFERENCES Irrigation (IrrigationId),
      FOREIGN KEY (CyclesId)     REFERENCES Cycles (CycleId),
      FOREIGN KEY (SesionId)     REFERENCES Sesion (SesionId),
      FOREIGN KEY (StateId)      REFERENCES ConfigurationState (ConfigStateId)
    );`,
    'Configuration'
  );

  /* ==========================================================================
   * TABLA: Flowerpot
   * --------------------------------------------------------------------------
   * Representa una maceta física del sistema: qué planta contiene, en qué
   * etapa de crecimiento se encuentra, qué configuración de riego tiene
   * asignada y a qué sesión/usuario pertenece.
   *
   * Nota: existe una relación circular intencional con
   * FlowerPotConfiguration (cada maceta apunta a su configuración activa, y
   * cada configuración registra a qué maceta fue aplicada). SQLite admite
   * referencias hacia adelante en llaves foráneas, por lo que el orden de
   * creación de ambas tablas no genera error.
   *
   * Campos:
   *   - FlowerpotId (PK, INTEGER AUTOINCREMENT): identificador único de la
   *     maceta.
   *   - PlantId (FK -> Plant.PlantId, INTEGER): especie/tipo de planta
   *     sembrada en la maceta.
   *   - GrowthStageId (FK -> GrowthStage.GrowthStageId, INTEGER): etapa de
   *     crecimiento actual de la planta en esta maceta.
   *   - FlowerPotConfiguration (FK -> FlowerPotConfiguration.Id, INTEGER):
   *     configuración de riego actualmente activa para esta maceta.
   *   - SesionId (FK -> Sesion.SesionId, INTEGER): sesión/usuario
   *     propietario de la maceta.
   * ========================================================================== */
  run(
    `CREATE TABLE IF NOT EXISTS Flowerpot (
      FlowerpotId             INTEGER PRIMARY KEY AUTOINCREMENT,
      PlantId                 INTEGER,
      GrowthStageId           INTEGER,
      FlowerPotConfiguration  INTEGER,
      SesionId                INTEGER,
      FOREIGN KEY (PlantId)                REFERENCES Plant (PlantId),
      FOREIGN KEY (GrowthStageId)          REFERENCES GrowthStage (GrowthStageId),
      FOREIGN KEY (FlowerPotConfiguration) REFERENCES FlowerPotConfiguration (Id),
      FOREIGN KEY (SesionId)               REFERENCES Sesion (SesionId)
    );`,
    'Flowerpot'
  );

  /* ==========================================================================
   * TABLA: FlowerPotConfiguration
   * --------------------------------------------------------------------------
   * Tabla puente que vincula una maceta (Flowerpot) con una configuración
   * de riego (Configuration) para una etapa de crecimiento (GrowthStage)
   * determinada. Permite tener distintas configuraciones de riego según en
   * qué etapa de crecimiento se encuentre la planta de la maceta.
   *
   * Campos:
   *   - Id (PK, INTEGER AUTOINCREMENT): identificador único del registro.
   *   - FlowerpotId (FK -> Flowerpot.FlowerpotId, INTEGER): maceta a la
   *     que aplica esta configuración.
   *   - ConfigurationId (FK -> Configuration.ConfigurationId, INTEGER):
   *     configuración de riego aplicada.
   *   - GrowthStageId (FK -> GrowthStage.GrowthStageId, INTEGER): etapa de
   *     crecimiento para la cual es válida esta configuración.
   * ========================================================================== */
  run(
    `CREATE TABLE IF NOT EXISTS FlowerPotConfiguration (
      Id              INTEGER PRIMARY KEY AUTOINCREMENT,
      FlowerpotId     INTEGER,
      ConfigurationId INTEGER,
      GrowthStageId   INTEGER,
      FOREIGN KEY (FlowerpotId)     REFERENCES Flowerpot (FlowerpotId),
      FOREIGN KEY (ConfigurationId) REFERENCES Configuration (ConfigurationId),
      FOREIGN KEY (GrowthStageId)   REFERENCES GrowthStage (GrowthStageId)
    );`,
    'FlowerPotConfiguration'
  );

  /* ==========================================================================
   * TABLA: Measurements
   * --------------------------------------------------------------------------
   * Registra cada lectura/medición tomada por los sensores de una maceta,
   * bajo una configuración determinada, junto con el estado de riego en
   * ese instante.
   *
   * Campos:
   *   - Id (PK, INTEGER AUTOINCREMENT): identificador único de la
   *     medición.
   *   - FlowerpotId (FK -> Flowerpot.FlowerpotId, INTEGER): maceta sobre
   *     la que se realizó la medición.
   *   - ConfigurationId (FK -> Configuration.ConfigurationId, INTEGER):
   *     configuración de riego vigente al momento de la medición.
   *   - TimeStamp (DATETIME, formato 'YYYY-MM-DD HH:MM:SS'): fecha y hora
   *     exacta en que se tomó la medición. Por defecto toma la fecha/hora
   *     actual.
   *   - SoilMoisture (INTEGER): humedad del suelo registrada por el sensor
   *     (nombre conservado tal como aparece en el diagrama original).
   *   - AmbientHumidity (INTEGER): humedad ambiental registrada por el
   *     sensor.
   *   - Temperature (INTEGER): temperatura ambiente registrada por el
   *     sensor.
   *   - IrrigationStateId (FK -> IrrigationStates.Id, INTEGER): estado del
   *     riego en el momento exacto de la medición.
   * ========================================================================== */
  run(
    `CREATE TABLE IF NOT EXISTS Measurements (
      Id                INTEGER PRIMARY KEY AUTOINCREMENT,
      FlowerpotId       INTEGER,
      ConfigurationId   INTEGER,
      TimeStamp         DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now')),
      SoilMoisture      INTEGER,
      AmbientHumidity   INTEGER,
      Temperature       INTEGER,
      IrrigationStateId INTEGER,
      FOREIGN KEY (FlowerpotId)       REFERENCES Flowerpot (FlowerpotId),
      FOREIGN KEY (ConfigurationId)   REFERENCES Configuration (ConfigurationId),
      FOREIGN KEY (IrrigationStateId) REFERENCES IrrigationStates (Id)
    );`,
    'Measurements'
  );

  /* ==========================================================================
   * ÍNDICES
   * --------------------------------------------------------------------------
   * Índices sobre las columnas de llave foránea más consultadas, para
   * acelerar los JOIN típicos del modelo (ej: histórico de mediciones por
   * maceta, configuraciones por sesión, etc.).
   * ========================================================================== */
  run('CREATE INDEX IF NOT EXISTS idx_user_stateid ON User (StateId);', 'idx_user_stateid');
  run('CREATE INDEX IF NOT EXISTS idx_sesion_userid ON Sesion (UserId);', 'idx_sesion_userid');
  run('CREATE INDEX IF NOT EXISTS idx_configuration_irrigationid ON Configuration (IrrigationId);', 'idx_configuration_irrigationid');
  run('CREATE INDEX IF NOT EXISTS idx_configuration_cyclesid ON Configuration (CyclesId);', 'idx_configuration_cyclesid');
  run('CREATE INDEX IF NOT EXISTS idx_configuration_sesionid ON Configuration (SesionId);', 'idx_configuration_sesionid');
  run('CREATE INDEX IF NOT EXISTS idx_flowerpot_plantid ON Flowerpot (PlantId);', 'idx_flowerpot_plantid');
  run('CREATE INDEX IF NOT EXISTS idx_flowerpot_growthstageid ON Flowerpot (GrowthStageId);', 'idx_flowerpot_growthstageid');
  run('CREATE INDEX IF NOT EXISTS idx_flowerpot_configid ON Flowerpot (FlowerPotConfiguration);', 'idx_flowerpot_configid');
  run('CREATE INDEX IF NOT EXISTS idx_flowerpot_sesionid ON Flowerpot (SesionId);', 'idx_flowerpot_sesionid');
  run('CREATE INDEX IF NOT EXISTS idx_fpc_flowerpotid ON FlowerPotConfiguration (FlowerpotId);', 'idx_fpc_flowerpotid');
  run('CREATE INDEX IF NOT EXISTS idx_fpc_configurationid ON FlowerPotConfiguration (ConfigurationId);', 'idx_fpc_configurationid');
  run('CREATE INDEX IF NOT EXISTS idx_fpc_growthstageid ON FlowerPotConfiguration (GrowthStageId);', 'idx_fpc_growthstageid');
  run('CREATE INDEX IF NOT EXISTS idx_measurements_flowerpotid ON Measurements (FlowerpotId);', 'idx_measurements_flowerpotid');
  run('CREATE INDEX IF NOT EXISTS idx_measurements_configurationid ON Measurements (ConfigurationId);', 'idx_measurements_configurationid');
  run('CREATE INDEX IF NOT EXISTS idx_measurements_irrigationstateid ON Measurements (IrrigationStateId);', 'idx_measurements_irrigationstateid');

  /* ==========================================================================
   * DATOS INICIALES: Estados de Usuario
   * --------------------------------------------------------------------------
   * Se insertan los estados base solo si la tabla UserState está vacía.
   * Estados: 1 = Activo, 2 = Bloqueado
   * ========================================================================== */
  db.get(`SELECT COUNT(*) as count FROM UserState`, (err, row) => {
    if (!err && row.count === 0) {
      db.run(
        `INSERT INTO UserState (UserStatId, Description) VALUES (1, 'Activo'), (2, 'Bloqueado')`,
        (err) => {
          if (err) {
            console.error('[SARA][DB] Error al insertar estados de usuario:', err.message);
          } else {
            console.log('[SARA][DB] Estados de usuario inicializados: Activo, Bloqueado');
          }
        }
      );
    }
  });

  /* ==========================================================================
   * DATOS INICIALES: Estados de Configuración
   * --------------------------------------------------------------------------
   * Se insertan los estados base solo si la tabla ConfigurationState está vacía.
   * Estados: 1 = Activa, 2 = Inactiva
   * ========================================================================== */
  db.get(`SELECT COUNT(*) as count FROM ConfigurationState`, (err, row) => {
    if (!err && row.count === 0) {
      db.run(
        `INSERT INTO ConfigurationState (ConfigStateId, Description) VALUES (1, 'Activa'), (2, 'Inactiva'), (3, 'Eliminada')`,
        (err) => {
          if (err) {
            console.error('[SARA][DB] Error al insertar estados de configuración:', err.message);
          } else {
            console.log('[SARA][DB] Estados de configuración inicializados: Activa, Inactiva, Eliminada');
          }
        }
      );
    }
  });

  if (!dbAlreadyExisted) {
    console.log('[SARA][DB] Base de datos creada por primera vez con todas las tablas e índices.');
  } else {
    console.log('[SARA][DB] Base de datos existente verificada/actualizada (CREATE TABLE IF NOT EXISTS).');
  }
});

/* ----------------------------------------------------------------------------
 * Se exporta la conexión `db` para que pueda ser reutilizada en cualquier
 * API route / server component de Next.js, por ejemplo:
 *
 *   const db = require('../../database');
 *   db.all('SELECT * FROM Flowerpot', [], (err, rows) => { ... });
 * -------------------------------------------------------------------------- */
module.exports = db;