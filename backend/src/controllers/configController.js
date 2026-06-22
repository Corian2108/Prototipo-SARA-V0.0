const db = require('../config/database');

// Obtiene la configuración actual del sistema de riego
// Entrada: ninguna
// Salida: JSON con parámetros de configuración {humedad_minima, humedad_objetivo, riego_maximo_segundos, ...}
const obtenerConfiguracion = (req, res) => {
    db.get(`SELECT * FROM configuracion_riego ORDER BY id DESC LIMIT 1`, (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Error al leer configuración' });
        }
        res.json(row || { humedad_minima: 40, humedad_objetivo: 60, riego_maximo_segundos: 10 });
    });
};

// Actualiza parámetros específicos de la configuración de riego
// Entrada: JSON con uno o más parámetros a actualizar {humedad_minima, humedad_objetivo, riego_maximo_segundos}
// Salida: JSON {status, message, changes} indicando cuántos registros fueron modificados
// Validación: al menos un parámetro debe ser proporcionado
const actualizarConfiguracion = (req, res) => {
    const { humedad_minima, humedad_objetivo, riego_maximo_segundos } = req.body;

    // Validar que se proporcione al menos un parámetro
    if (!humedad_minima && !humedad_objetivo && !riego_maximo_segundos) {
        return res.status(400).json({ error: 'No se proporcionaron parámetros para actualizar' });
    }

    // Construir dinámicamente la sentencia UPDATE solo con parámetros proporcionados
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

    // Agregar timestamp de actualización
    updates.push('updated_at = CURRENT_TIMESTAMP');

    // Generar SQL dinámicamente y actualizar el registro más reciente
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
