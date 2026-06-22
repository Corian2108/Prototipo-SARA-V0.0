const db = require('../config/database');

// Evalúa si debe iniciar un ciclo de riego basado en configuración experimental
// Entrada: humedadActual (number), configuracion (object), ultimaActivacionRiego (timestamp)
// Salida: {debeRegar: boolean, mensaje: string}
// Lógica:
//   - Si humedad < mínimo: evalúa modo de riego
//   - Modo constante (tiempo_espera=0): regar inmediatamente
//   - Modo húmedo-seco: regar solo si pasó el tiempo de espera
const evaluarNecesidadRiego = (humedadActual, configuracion, ultimaActivacionRiego) => {
    const { humedad_minima, tiempo_espera_entre_riegos } = configuracion;

    // Si humedad está por encima del mínimo, no regar
    if (humedadActual >= humedad_minima) {
        return {
            debeRegar: false,
            mensaje: `✅ Humedad suficiente: ${humedadActual}% (mínimo: ${humedad_minima}%)`
        };
    }

    // Humedad está por debajo del mínimo
    // En modo constante (tiempo_espera = 0), regar inmediatamente
    if (tiempo_espera_entre_riegos === 0) {
        return {
            debeRegar: true,
            modo: 'constante',
            mensaje: `💧 Modo constante: humedad ${humedadActual}% < mínimo ${humedad_minima}%, iniciando riego`
        };
    }

    // En modo húmedo-seco, verificar si pasó el tiempo de espera
    if (!ultimaActivacionRiego) {
        // Primera vez que se detecta sequedad, registrar tiempo
        return {
            debeRegar: false,
            modo: 'humedo-seco',
            esperando: true,
            mensaje: `⏳ Modo húmedo-seco: sequedad detectada, esperando ${tiempo_espera_entre_riegos} minutos`
        };
    }

    const ahora = new Date();
    const minutosDesdeUltimo = (ahora - ultimaActivacionRiego) / (1000 * 60);

    if (minutosDesdeUltimo >= tiempo_espera_entre_riegos) {
        return {
            debeRegar: true,
            modo: 'humedo-seco',
            mensaje: `💧 Modo húmedo-seco: ${minutosDesdeUltimo.toFixed(1)}min de espera completados, iniciando riego`
        };
    }

    return {
        debeRegar: false,
        modo: 'humedo-seco',
        esperando: true,
        tiempoRestante: tiempo_espera_entre_riegos - minutosDesdeUltimo,
        mensaje: `⏳ Esperando ${(tiempo_espera_entre_riegos - minutosDesdeUltimo).toFixed(1)} min más`
    };
};

// Evalúa si un ciclo de riego se ha completado (alcanzó humedad_maxima)
// Entrada: humedadActual (number), humedadAnterior (number), config (object)
// Salida: {cicloCompleto: boolean, mensaje: string}
const evaluarCicloCompleto = (humedadActual, humedadAnterior, config) => {
    const { humedad_maxima } = config;

    if (humedadActual >= humedad_maxima) {
        return {
            cicloCompleto: true,
            mensaje: `✅ Ciclo completado: humedad ${humedadActual}% >= objetivo ${humedad_maxima}%`
        };
    }

    return {
        cicloCompleto: false,
        mensaje: `🔄 Ciclo en progreso: humedad ${humedadActual}% < objetivo ${humedad_maxima}%`
    };
};

// Obtiene el número de ciclo siguiente para una maceta en una etapa
// Entrada: maceta_id (string), etapa_id (number)
// Salida: Promise<number> - número del próximo ciclo
const obtenerProximoNumeroCiclo = (macetaId, etapaId) => {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT COALESCE(MAX(numero_ciclo), 0) + 1 as proximo_numero
             FROM ciclos_riego
             WHERE maceta_id = ? AND etapa_crecimiento_id = ?
             AND DATE(fecha_inicio) = DATE('now')`,
            [macetaId, etapaId],
            (err, row) => {
                if (err) reject(err);
                resolve(row ? row.proximo_numero : 1);
            }
        );
    });
};

module.exports = {
    evaluarNecesidadRiego,
    evaluarCicloCompleto,
    obtenerProximoNumeroCiclo
};
