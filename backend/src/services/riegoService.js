const evaluarRiego = (humedadActual, configuracion) => {
    const { humedad_minima = 40, riego_maximo_segundos = 10 } = configuracion;

    if (humedadActual < humedad_minima) {
        // Calcular duración proporcional (más seco = más tiempo)
        const deficit = (humedad_minima - humedadActual) / 100;
        const duracionMs = Math.min(
            riego_maximo_segundos * 1000,
            Math.max(2000, deficit * riego_maximo_segundos * 1000)
        );

        return {
            encenderBomba: true,
            duracionMs: Math.floor(duracionMs),
            mensaje: `💧 Regando: humedad ${humedadActual}% < umbral ${humedad_minima}%`
        };
    }

    return {
        encenderBomba: false,
        duracionMs: 0,
        mensaje: `✅ Humedad suficiente: ${humedadActual}% (umbral: ${humedad_minima}%)`
    };
};

module.exports = { evaluarRiego };