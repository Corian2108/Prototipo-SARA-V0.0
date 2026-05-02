const validarDatosSensor = (req, res, next) => {
    const { humedad, temperatura } = req.body;

    if (humedad === undefined || temperatura === undefined) {
        return res.status(400).json({
            error: 'Datos incompletos',
            required: ['humedad', 'temperatura'],
            received: Object.keys(req.body)
        });
    }

    if (humedad < 0 || humedad > 100) {
        return res.status(400).json({ error: 'Humedad debe estar entre 0 y 100' });
    }

    if (temperatura < -10 || temperatura > 60) {
        return res.status(400).json({ error: 'Temperatura fuera de rango válido' });
    }

    next();
};

module.exports = { validarDatosSensor };