const db = require('../config/database');

const obtenerConfiguracion = (req, res) => {
    db.get(`SELECT * FROM configuracion_riego ORDER BY id DESC LIMIT 1`, (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Error al leer configuración' });
        }
        res.json(row || { humedad_minima: 40, humedad_objetivo: 60, riego_maximo_segundos: 10 });
    });
};

const actualizarConfiguracion = (req, res) => {
    const { humedad_minima, humedad_objetivo, riego_maximo_segundos } = req.body;

    if (!humedad_minima && !humedad_objetivo && !riego_maximo_segundos) {
        return res.status(400).json({ error: 'No se proporcionaron parámetros para actualizar' });
    }

    const updates = [];
    const values = [];

    if (humedad_minima !== undefined) {
        updates.push('humedad_minima = ?');
        values.push(humedad_minima);
    }

    if (humedad_objetivo !== undefined) {
        updates.push('humedad_objetivo = ?');
        values.push(humedad_objetivo);
    }

    if (riego_maximo_segundos !== undefined) {
        updates.push('riego_maximo_segundos = ?');
        values.push(riego_maximo_segundos);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const sql = `UPDATE configuracion_riego SET ${updates.join(', ')} WHERE id = (SELECT id FROM configuracion_riego ORDER BY id DESC LIMIT 1)`;

    db.run(sql, values, function (err) {
        if (err) {
            console.error('Error al actualizar:', err);
            return res.status(500).json({ error: 'Error al actualizar configuración' });
        }

        res.json({
            status: 'ok',
            message: 'Configuración actualizada',
            changes: this.changes
        });
    });
};

module.exports = {
    obtenerConfiguracion,
    actualizarConfiguracion
};