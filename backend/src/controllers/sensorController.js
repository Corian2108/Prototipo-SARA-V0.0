const db = require('../config/database');
const { evaluarNecesidadRiego, evaluarCicloCompleto, obtenerProximoNumeroCiclo } = require('../services/riegoService');

// Recibe datos de medición del ESP32 y evalúa necesidad de riego
// Entrada: JSON {
//   maceta_id: string,
//   etapa_crecimiento_id: number,
//   humedad_tierra: number (0-100),
//   humedad_ambiente: number (0-100),
//   temperatura_ambiente: number
// }
// Salida: JSON {status, debe_regar, numero_ciclo, mensajes}
const recibirMedicion = async (req, res) => {
    try {
        const { maceta_id, etapa_crecimiento_id, humedad_tierra, humedad_ambiente, temperatura_ambiente } = req.body;

        // Validar datos requeridos
        if (!maceta_id || !etapa_crecimiento_id || humedad_tierra === undefined) {
            return res.status(400).json({ error: 'Faltan datos: maceta_id, etapa_crecimiento_id, humedad_tierra' });
        }

        if (humedad_tierra < 0 || humedad_tierra > 100) {
            return res.status(400).json({ error: 'humedad_tierra debe estar entre 0 y 100' });
        }

        // Obtener configuración para esta maceta y etapa
        const config = await new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM configuracion_riego
                 WHERE maceta_id = ? AND etapa_crecimiento_id = ? AND activa = 1`,
                [maceta_id, etapa_crecimiento_id],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        if (!config) {
            return res.status(404).json({ error: `No existe configuración para maceta ${maceta_id}, etapa ${etapa_crecimiento_id}` });
        }

        // Guardar medición en tabla lecturas
        db.run(
            `INSERT INTO lecturas (maceta_id, humedad_tierra, humedad_ambiente, temperatura_ambiente)
             VALUES (?, ?, ?, ?)`,
            [maceta_id, humedad_tierra, humedad_ambiente, temperatura_ambiente],
            async function (err) {
                if (err) {
                    console.error('Error al guardar lectura:', err);
                    return res.status(500).json({ error: 'Error al guardar medición' });
                }

                // Obtener última activación de riego para este ciclo (si existe)
                const ultimaActivacion = await new Promise((resolve, reject) => {
                    db.get(
                        `SELECT fecha_inicio FROM ciclos_riego
                         WHERE maceta_id = ? AND etapa_crecimiento_id = ?
                         AND humedad_fin IS NULL
                         ORDER BY fecha_inicio DESC LIMIT 1`,
                        [maceta_id, etapa_crecimiento_id],
                        (err, row) => {
                            if (err) reject(err);
                            resolve(row ? new Date(row.fecha_inicio) : null);
                        }
                    );
                });

                // Evaluar necesidad de riego
                const evaluacion = evaluarNecesidadRiego(humedad_tierra, config, ultimaActivacion);

                // Verificar si hay un ciclo en progreso sin humedad_fin
                const cicloEnProgreso = await new Promise((resolve, reject) => {
                    db.get(
                        `SELECT * FROM ciclos_riego
                         WHERE maceta_id = ? AND etapa_crecimiento_id = ?
                         AND humedad_fin IS NULL
                         ORDER BY fecha_inicio DESC LIMIT 1`,
                        [maceta_id, etapa_crecimiento_id],
                        (err, row) => {
                            if (err) reject(err);
                            resolve(row);
                        }
                    );
                });

                let numeroCiclo = null;
                let respuestaRiego = {
                    status: 'ok',
                    lectura_id: this.lastID,
                    debe_regar: evaluacion.debeRegar,
                    mensajes: [evaluacion.mensaje]
                };

                // Si hay ciclo en progreso, registrar humedad_fin y evaluar si se completa
                if (cicloEnProgreso) {
                    numeroCiclo = cicloEnProgreso.numero_ciclo;

                    // Actualizar ciclo con humedad_fin
                    await new Promise((resolve, reject) => {
                        db.run(
                            `UPDATE ciclos_riego
                             SET humedad_fin = ?, fecha_fin = CURRENT_TIMESTAMP
                             WHERE id = ?`,
                            [humedad_tierra, cicloEnProgreso.id],
                            (err) => {
                                if (err) reject(err);
                                resolve();
                            }
                        );
                    });

                    // Evaluar si ciclo se completó
                    const completitud = evaluarCicloCompleto(humedad_tierra, cicloEnProgreso.humedad_inicio, config);
                    respuestaRiego.ciclo_completado = completitud.cicloCompleto;
                    respuestaRiego.mensajes.push(completitud.mensaje);

                    // Si no está completo y debe regar de nuevo, crear nuevo ciclo
                    if (!completitud.cicloCompleto && evaluacion.debeRegar) {
                        numeroCiclo = await obtenerProximoNumeroCiclo(maceta_id, etapa_crecimiento_id);
                        await new Promise((resolve, reject) => {
                            db.run(
                                `INSERT INTO ciclos_riego
                                 (maceta_id, etapa_crecimiento_id, numero_ciclo, humedad_inicio, bomba_activada)
                                 VALUES (?, ?, ?, ?, 1)`,
                                [maceta_id, etapa_crecimiento_id, numeroCiclo, humedad_tierra],
                                (err) => {
                                    if (err) reject(err);
                                    resolve();
                                }
                            );
                        });
                        respuestaRiego.numero_ciclo = numeroCiclo;
                        respuestaRiego.comando = {
                            accion: 'activar_bomba',
                            duracion_segundos: 5,
                            espera_post_riego_segundos: 15
                        };
                    }
                } else if (evaluacion.debeRegar) {
                    // Crear nuevo ciclo de riego
                    numeroCiclo = await obtenerProximoNumeroCiclo(maceta_id, etapa_crecimiento_id);
                    await new Promise((resolve, reject) => {
                        db.run(
                            `INSERT INTO ciclos_riego
                             (maceta_id, etapa_crecimiento_id, numero_ciclo, humedad_inicio, bomba_activada)
                             VALUES (?, ?, ?, ?, 1)`,
                            [maceta_id, etapa_crecimiento_id, numeroCiclo, humedad_tierra],
                            (err) => {
                                if (err) reject(err);
                                resolve();
                            }
                        );
                    });
                    respuestaRiego.numero_ciclo = numeroCiclo;
                    respuestaRiego.comando = {
                        accion: 'activar_bomba',
                        duracion_segundos: 5,
                        espera_post_riego_segundos: 15
                    };
                }

                res.json(respuestaRiego);
            }
        );
    } catch (error) {
        console.error('Error en recibirMedicion:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Obtiene historial de ciclos de riego para una maceta
// Entrada: query params: maceta_id, etapa_crecimiento_id (opcional), dias (default 7)
// Salida: array de ciclos con información de humedad y duraciones
const obtenerHistorialCiclos = (req, res) => {
    const { maceta_id, etapa_crecimiento_id } = req.query;
    const dias = req.query.dias || 7;

    if (!maceta_id) {
        return res.status(400).json({ error: 'Se requiere maceta_id en query parameters' });
    }

    let sql = `SELECT * FROM ciclos_riego
               WHERE maceta_id = ? AND fecha_inicio > datetime('now', '-' || ? || ' days')`;
    const params = [maceta_id, dias];

    if (etapa_crecimiento_id) {
        sql += ` AND etapa_crecimiento_id = ?`;
        params.push(etapa_crecimiento_id);
    }

    sql += ` ORDER BY fecha_inicio DESC`;

    db.all(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Error al leer historial' });
        }
        res.json(rows || []);
    });
};

// Obtiene estadísticas de ciclos de riego
// Entrada: query params: maceta_id, etapa_crecimiento_id (opcional), dias (default 1)
// Salida: {total_ciclos, ciclos_completados, humedad_promedio_inicio, humedad_promedio_fin}
const obtenerEstadisticasCiclos = (req, res) => {
    const { maceta_id, etapa_crecimiento_id } = req.query;
    const dias = req.query.dias || 1;

    if (!maceta_id) {
        return res.status(400).json({ error: 'Se requiere maceta_id en query parameters' });
    }

    let sql = `SELECT
                COUNT(*) as total_ciclos,
                SUM(CASE WHEN humedad_fin IS NOT NULL THEN 1 ELSE 0 END) as ciclos_completados,
                AVG(humedad_inicio) as humedad_promedio_inicio,
                AVG(CASE WHEN humedad_fin IS NOT NULL THEN humedad_fin ELSE NULL END) as humedad_promedio_fin,
                AVG(CASE WHEN humedad_fin IS NOT NULL THEN humedad_fin - humedad_inicio ELSE NULL END) as humedad_promedio_incremento
               FROM ciclos_riego
               WHERE maceta_id = ? AND fecha_inicio > datetime('now', '-' || ? || ' days')`;
    const params = [maceta_id, dias];

    if (etapa_crecimiento_id) {
        sql += ` AND etapa_crecimiento_id = ?`;
        params.push(etapa_crecimiento_id);
    }

    db.get(sql, params, (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Error al calcular estadísticas' });
        }
        res.json(row || {});
    });
};

module.exports = {
    recibirMedicion,
    obtenerHistorialCiclos,
    obtenerEstadisticasCiclos
};
