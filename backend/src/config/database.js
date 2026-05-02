const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../database.db');
const db = new sqlite3.Database(dbPath);

// Inicializar tablas
db.serialize(() => {
    db.run(`
    CREATE TABLE IF NOT EXISTS lecturas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      humedad REAL,
      temperatura REAL,
      humedad_ambiente REAL,
      bomba_activada BOOLEAN,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS configuracion_riego (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        maceta_id TEXT DEFAULT 'maceta_001',
        humedad_minima INTEGER DEFAULT 40,
        humedad_objetivo INTEGER DEFAULT 60,
        riego_maximo_segundos INTEGER DEFAULT 10,
        horario_inicio TEXT DEFAULT '06:00',
        horario_fin TEXT DEFAULT '20:00',
        coeficiente_planta REAL DEFAULT 1.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME
    )
  `);

    // Insertar configuración por defecto si no existe
    db.get(`SELECT COUNT(*) as count FROM configuracion_riego`, (err, row) => {
        if (row.count === 0) {
            db.run(`INSERT INTO configuracion_riego (humedad_minima, humedad_objetivo, riego_maximo_segundos) VALUES (40, 60, 10)`);
        }
    });
});

module.exports = db;