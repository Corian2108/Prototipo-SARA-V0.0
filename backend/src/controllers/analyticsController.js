const db = require('../config/database');

const obtenerResumen = (req, res) => {
    const dias = req.query.dias || 1;

    db.get(`
    SELECT 
        AVG(humedad) as humedad_promedio,
        MIN(humedad) as humedad_minima,
        MAX(humedad) as humedad_maxima,
        AVG(temperatura) as temperatura_promedio,
        SUM(CASE WHEN bomba_activada = 1 THEN 1 ELSE 0 END) as ciclos_riego,
        COUNT(*) as total_lecturas
    FROM lecturas 
    WHERE fecha > datetime('now', '-' || ? || ' days')
    `, [dias], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Error al generar resumen' });
        }
        res.json(row || {});
    });
};

const exportarCSV = (req, res) => {
    const dias = req.query.dias || 7;

    db.all(`
        SELECT fecha, humedad, temperatura, humedad_ambiente, bomba_activada 
        FROM lecturas 
        WHERE fecha > datetime('now', '-' || ? || ' days')
        ORDER BY fecha DESC
    `, [dias], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Error al exportar datos' });
        }

        let csv = 'Fecha,Humedad(%),Temperatura(°C),Humedad Ambiente(%),Bomba Activada\n';
        rows.forEach(row => {
            csv += `${row.fecha},${row.humedad},${row.temperatura},${row.humedad_ambiente || ''},${row.bomba_activada ? 'Si' : 'No'}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=datos_riego_${dias}_dias.csv`);
        res.send(csv);
    });
};

module.exports = {
    obtenerResumen,
    exportarCSV
};