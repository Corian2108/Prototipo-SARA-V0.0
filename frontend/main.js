const baseURL = 'http://localhost:3000/api';
function actualizarDashboard() {
    fetch(`${baseURL}/sensor/ultimo`)
        .then(res => res.json())
        .then(data => {
            if (data && data.id) {
                document.getElementById('humedad').textContent = data.humedad || '--';
                document.getElementById('temperatura').textContent = data.temperatura || '--';
                document.getElementById('humedad_ambiente').textContent = data.humedad_ambiente || '--';

                // Estado de humedad del suelo
                const humedadStatus = document.getElementById('humedad-status');
                if (data.humedad < 30) {
                    humedadStatus.innerHTML = '<span class="status status-active">⚠️ Muy seco - Regando</span>';
                } else if (data.humedad < 50) {
                    humedadStatus.innerHTML = '<span class="status status-active">💧 Húmedo - Correcto</span>';
                } else {
                    humedadStatus.innerHTML = '<span class="status status-inactive">✅ Muy húmedo - No regar</span>';
                }

                // Estado de la bomba
                const bombaStatus = document.getElementById('bomba-status');
                if (data.bomba_activada == 1) {
                    bombaStatus.innerHTML = '<div class="sensor-value" style="color: #4caf50;">🟢 ACTIVADA</div><p style="color: #666;">Regando en este momento...</p>';
                } else {
                    bombaStatus.innerHTML = '<div class="sensor-value" style="color: #999;">⚫ APAGADA</div><p style="color: #666;">Esperando condiciones</p>';
                }

                document.getElementById('timestamp').innerHTML = `Última actualización: ${new Date(data.fecha).toLocaleString()}`;

                document.getElementById('loading').style.display = 'none';
                document.getElementById('dashboard').style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('loading').innerHTML = '❌ Error conectando al servidor. ¿Está ejecutándose server.js?';
        });

    // Cargar historial
    // fetch(`${baseURL}/historial`)
    //     .then(res => res.json())
    //     .then(data => {
    //         const tbody = document.getElementById('historial-body');
    //         if (data.length === 0) {
    //             tbody.innerHTML = '<tr><td colspan="4">Sin datos históricos aún</td></tr>';
    //             return;
    //         }

    //         tbody.innerHTML = data.map(row => `
    //                     <tr>
    //                         <td>${new Date(row.fecha).toLocaleString()}</td>
    //                         <td>${row.humedad}%</td>
    //                         <td>${row.temperatura}°C</td>
    //                         <td>${row.bomba_activada ? '🟢 Activada' : '⚫ Apagada'}</td>
    //                     </tr>
    //                 `).join('');
    //     });
}

// Actualizar cada minuto
actualizarDashboard();
setInterval(actualizarDashboard, 60000);