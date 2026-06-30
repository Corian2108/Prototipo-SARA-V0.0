const baseURL = 'http://localhost:3000/api';
let configCache = null;
let currentTab = 'config';

// Cambia entre las diferentes pestañas (config, analytics, sensor) ocultando el contenido actual y mostrando el seleccionado.
// Carga el contenido correspondiente si es la primera vez que se accede a la pestaña.
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(el => el.classList.remove('active'));
    document.getElementById(tabName + '-tab').classList.add('active');
    document.querySelector(`button[onclick="showTab('${tabName}')"]`).classList.add('active');
    currentTab = tabName;
    if (tabName === 'config' && !configCache) {
        obtenerConfiguracion();
    } else if (tabName === 'analytics') {
        cargarAnalytics();
    } else if (tabName === 'sensor') {
        actualizarDashboard();
    }
}

// Cierra la sesión actual del usuario eliminando el token de autenticación del almacenamiento local y recargando la página para mostrar la vista de login.
function cerrarSesion() {
    fetch(`${baseURL}/auth/logout`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
    })
    localStorage.removeItem('authToken');
    location.reload();
}

// Configura el sistema enviando los datos de usuario y contraseña al servidor para crear la cuenta inicial.
function configurarSistema(setupData) {
    fetch(`${baseURL}/auth/setup`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(setupData)
    })
        .then(res => res.json())
        .then(data => {
            alert('Sistema configurado:', data);
            document.getElementById('setup-view').style.display = 'none';
            document.getElementById('login-view').style.display = 'block';
        })
        .catch(error => {
            alert('Error configurando el sistema');
            console.error('Error configurando el sistema:', error);
        });
}

// Inicio de sesión en el sistema enviando los datos de usuario y contraseña al servidor.
function iniciarSesion(loginData) {
    fetch(`${baseURL}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(loginData)
    })
        .then(res => res.json())
        .then(data => {
            if (data.status == 'ok') {
                //guardar token en localstorage para futuras peticiones autenticadas
                localStorage.setItem('authToken', data.token);
                document.getElementById('login-view').style.display = 'none';
                document.getElementById('dashboard-view').style.display = 'block';
            } else {
                alert('Error al iniciar sesión. Verifique sus credenciales.');
            }
        })
        .catch(error => {
            alert('Error al iniciar sesión. Verifique sus credenciales.');
            console.error('Error iniciando sesión:', error);
        });
}

// Obtiene la última lectura de sensores desde el servidor y actualiza el dashboard con valores de humedad, temperatura
// y estado de la bomba de riego. Muestra avisos visuales según los niveles de humedad detectados.
function actualizarDashboard() {
    fetch(`${baseURL}/sensor/ultimo`)
        .then(res => res.json())
        .then(data => {
            if (data && data.id) {
                document.getElementById('humedad').textContent = data.humedad || '--';
                document.getElementById('temperatura').textContent = data.temperatura || '--';
                document.getElementById('humedad_ambiente').textContent = data.humedad_ambiente || '--';

                const humedadStatus = document.getElementById('humedad-status');
                if (data.humedad < 30) {
                    humedadStatus.innerHTML = '<span class="status status-active">⚠️ Muy seco - Regando</span>';
                } else if (data.humedad < 50) {
                    humedadStatus.innerHTML = '<span class="status status-active">💧 Húmedo - Correcto</span>';
                } else {
                    humedadStatus.innerHTML = '<span class="status status-inactive">✅ Muy húmedo - No regar</span>';
                }

                const bombaStatus = document.getElementById('bomba-status');
                if (data.bomba_activada == 1) {
                    bombaStatus.innerHTML = '<div class="sensor-value" style="color: #4caf50;">🟢 ACTIVADA</div><p style="color: #666;">Regando en este momento...</p>';
                } else {
                    bombaStatus.innerHTML = '<div class="sensor-value" style="color: #999;">⚫ APAGADA</div><p style="color: #666;">Esperando condiciones</p>';
                }

                document.getElementById('timestamp').innerHTML = `Última actualización: ${new Date(data.fecha).toLocaleString()}`;

                document.getElementById('loading').style.display = 'none';
                document.getElementById('main-content').style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('loading').innerHTML = '❌ Error conectando al servidor. ¿Está ejecutándose server.js?';
        });
}

// Recupera la configuración actual del sistema desde el servidor. Utiliza caché para evitar peticiones repetidas.
// Si hay configuración en caché, la muestra sin hacer una nueva solicitud al servidor.
function obtenerConfiguracion() {
    if (configCache) {
        mostrarConfig(configCache);
        return;
    }
    fetch(`${baseURL}/config`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
    })
        .then(res => res.json())
        .then(data => {
            configCache = data;
            mostrarConfig(data);
        })
        .catch(error => {
            alert('Error obteniendo configuración del sistema');
            console.error('Error obteniendo configuración:', error);
        });
}

// Muestra la configuración actual en la pantalla y completa los campos del formulario con los valores actuales
// de humedad mínima, humedad objetivo y tiempo máximo de riego.
function mostrarConfig(data) {
    const display = document.getElementById('config-display');
    display.innerHTML = `
        <p>Humedad Mínima: ${data.humedad_minima}</p>
        <p>Humedad Objetivo: ${data.humedad_objetivo}</p>
        <p>Riego Máximo Segundos: ${data.riego_maximo_segundos}</p>
    `;
    document.getElementById('humedad_minima').value = data.humedad_minima;
    document.getElementById('humedad_objetivo').value = data.humedad_objetivo;
    // document.getElementById('riego_maximo_segundos').value = data.riego_maximo_segundos;
}

// Envía una nueva configuración al servidor mediante una petición PUT. Después de actualizar,
// invalida el caché y recarga la configuración para reflejar los cambios.
function cargarNuevaConfiguracion(configData) {
    fetch(`${baseURL}/config`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(configData)
    })
        .then(res => res.json())
        .then(data => {
            console.log('Configuración actualizada:', data);
            configCache = null;
            obtenerConfiguracion();
            alert('Configuración actualizada');
        })
        .catch(error => {
            console.error('Error actualizando configuración:', error);
            alert('Error actualizando configuración');
        });
}

// Obtiene un resumen de estadísticas del sistema desde el servidor y muestra en pantalla
// el total de lecturas, promedios de humedad y temperatura, y número de ciclos de riego.
function cargarAnalytics() {
    fetch(`${baseURL}/analytics/resumen`)
        .then(res => res.json())
        .then(data => {
            const summary = document.getElementById('analytics-summary');
            summary.innerHTML = `
                <p>Total de Lecturas: ${data.total_lecturas || 0}</p>
                <p>Promedio Humedad: ${data.humedad_promedio ? data.humedad_promedio.toFixed(1) : '--'}%</p>
                <p>Promedio Temperatura: ${data.temperatura_promedio ? data.temperatura_promedio.toFixed(1) : '--'}°C</p>
                <p>Ciclos de Riego: ${data.ciclos_riego || 0}</p>
            `;
        })
        .catch(error => {
            console.error('Error obteniendo analytics:', error);
        });
}

// Descarga un archivo CSV con todas las mediciones almacenadas desde el servidor.
// Crea un vínculo temporal para iniciar la descarga automáticamente.
function exportCSV() {
    fetch(`${baseURL}/analytics/exportar-csv`)
        .then(res => res.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'mediciones.csv';
            a.click();
            window.URL.revokeObjectURL(url);
        })
        .catch(error => {
            console.error('Error exportando CSV:', error);
        });
}

// Obtiene el historial completo de lecturas de sensores desde el servidor y construye una tabla
// con fecha, humedad, temperatura y estado de la bomba. Muestra un mensaje si no hay datos disponibles.
function cargarHistorial() {
    fetch(`${baseURL}/sensor/historial`)
        .then(res => res.json())
        .then(data => {
            const tbody = document.getElementById('historial-body');
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4">Sin datos históricos aún</td></tr>';
                return;
            }
            tbody.innerHTML = data.map(row => `
                        <tr>
                            <td>${new Date(row.fecha).toLocaleString()}</td>
                            <td>${row.humedad}%</td>
                            <td>${row.temperatura}°C</td>
                            <td>${row.bomba_activada ? '🟢 Activada' : '⚫ Apagada'}</td>
                        </tr>
                    `).join('');
        })
        .catch(error => {
            console.error('Error cargando historial:', error);
        });
}

// Captura el envío del formulario de configuración. Extrae los valores ingresados, los convierte a enteros
// y los envía al servidor para actualizar la configuración del sistema.
document.getElementById('config-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const configData = {
        humedad_minima: parseInt(document.getElementById('humedad_minima').value),
        humedad_objetivo: parseInt(document.getElementById('humedad_objetivo').value),
        riego_maximo_segundos: parseInt(document.getElementById('riego_maximo_segundos').value)
    };
    cargarNuevaConfiguracion(configData);
});

// Captura el envío del formulario de loginn. Extrae los valores ingresados, los convierte a enteros
// y los envía al servidor para actualizar la configuración del sistema.
document.getElementById('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const loginData = {
        usuario: document.getElementById('login-usuario').value,
        contrasena: document.getElementById('login-contrasena').value
    };
    iniciarSesion(loginData);
});

// Captura el envío del formulario de loginn. Extrae los valores ingresados, los convierte a enteros
// y los envía al servidor para actualizar la configuración del sistema.
document.getElementById('setup-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const setupData = {
        usuario: document.getElementById('setup-usuario').value,
        contrasena: document.getElementById('setup-contrasena').value
    };
    configurarSistema(setupData);
});

// Se ejecuta cuando el DOM está completamente cargado. Oculta la pantalla de carga
// y muestra la vista de configuración inicial del sistema, el login o la vista principal según el estado.
document.addEventListener('DOMContentLoaded', function () {
    let token = localStorage.getItem('authToken');
    if (token !== '' || token != null) {
        fetch(`${baseURL}/auth/check-setup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token })
        })
            .then(res => res.json())
            .then(data => {
                if (data.isSetup && data.hasActiveSessions) {
                    document.getElementById('loading').style.display = 'none';
                    if (data.hasActiveSessions) {
                        document.getElementById('dashboard-view').style.display = 'block';
                        obtenerConfiguracion();
                    } else {
                        document.getElementById('login-view').style.display = 'block';
                    }
                } else {
                    document.getElementById('setup-view').style.display = 'block';
                }
            })
    }else{
        document.getElementById('loading').style.display = 'none';
        document.getElementById('login-view').style.display = 'block';
    }
});