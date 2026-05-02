const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
    credentials: true
}));
app.use(express.json());
app.use(express.static('.')); // Sirve archivos estáticos

// Inicializar base de datos
const db = new sqlite3.Database('database.db');
db.run(`
  CREATE TABLE IF NOT EXISTS lecturas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    humedad REAL,
    temperatura REAL,
    humedad_ambiente REAL,
    bomba_activada BOOLEAN,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP
    );

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
);
`);

// Endpoint para recibir datos del ESP32
app.post('/api/sensor', (req, res) => {
    const { humedad, temperatura, humedad_ambiente } = req.body;
    const bomba_activada = humedad < 40; // Lógica de riego (ajustable)

    db.run(
        'INSERT INTO lecturas (humedad, temperatura, humedad_ambiente, bomba_activada) VALUES (?, ?, ?, ?)',
        [humedad, temperatura, humedad_ambiente, bomba_activada],
        function (err) {
            if (err) {
                console.error('Error al guardar:', err);
                return res.status(500).json({ error: 'Error en base de datos' });
            }

            res.json({
                status: 'ok',
                encender_bomba: bomba_activada,
                mensaje: bomba_activada ? '💦 Regando...' : '✅ Humedad suficiente'
            });
        }
    );
});

// Endpoint para obtener la última lectura
app.get('/api/ultimo', (req, res) => {
    db.get('SELECT * FROM lecturas ORDER BY fecha DESC LIMIT 1', (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Error al leer datos' });
        }
        res.json(row || {});
    });
});

// Endpoint para obtener historial (últimas 24 horas)
app.get('/api/historial', (req, res) => {
    db.all(
        'SELECT * FROM lecturas WHERE fecha > datetime("now", "-1 day") ORDER BY fecha DESC',
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Error al leer historial' });
            }
            res.json(rows);
        }
    );
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`\n🚀 Servidor corriendo en: http://localhost:${PORT}`);
    console.log('📊 Dashboard disponible en: http://localhost:3000\n');
});