const db = require('../config/database');
const { evaluarRiego } = require('../services/riegoService');

const recibirDatosSensor = async (req, res) => {
    try {
        const { humedad, temperatura, humedad_ambiente } = req.body;

        // Validaciones básicas
        if (humedad === undefined || temperatura === undefined) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }

        // Obtener configuración actual
        const config = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM configuracion_riego ORDER BY id DESC LIMIT 1`, (err, row) => {
                if (err) reject(err);
                resolve(row || { humedad_minima: 40, humedad_objetivo: 60, riego_maximo_segundos: 10 });
            });
        });

        // Evaluar si debe regar
        const decision = evaluarRiego(humedad, config);

        // Guardar en base de datos
        db.run(
            `INSERT INTO lecturas (humedad, temperatura, humedad_ambiente, bomba_activada) 
       VALUES (?, ?, ?, ?)`,
            [humedad, temperatura, humedad_ambiente, decision.encenderBomba ? 1 : 0],
            function (err) {
                if (err) {
                    console.error('Error al guardar:', err);
                    return res.status(500).json({ error: 'Error en base de datos' });
                }

                res.json({
                    status: 'ok',
                    id: this.lastID,
                    encender_bomba: decision.encenderBomba,
                    duracion_ms: decision.duracionMs,
                    mensaje: decision.mensaje
                });
            }
        );
    } catch (error) {
        console.error('Error en controller:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

const obtenerUltimaLectura = (req, res) => {
    db.get(`SELECT * FROM lecturas ORDER BY fecha DESC LIMIT 1`, (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Error al leer datos' });
        }
        res.json(row || {});
    });
};

const obtenerHistorial = (req, res) => {
    const limite = req.query.limite || 24; // horas
    db.all(
        `SELECT * FROM lecturas 
            WHERE fecha > datetime('now', '-' || ? || ' hours') 
            ORDER BY fecha DESC`,
        [limite],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Error al leer historial' });
            }
            res.json(rows);
        }
    );
};

module.exports = {
    recibirDatosSensor,
    obtenerUltimaLectura,
    obtenerHistorial
};