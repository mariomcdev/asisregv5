// ===================================================
// CONFIGURACIÓN DE SUPABASE (mismas credenciales)
// ===================================================
const SUPABASE_URL = 'https://pewiapusktjtjttxgdwg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBld2lhcHVza3RqdGp0dHhnZHdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjM5NjIsImV4cCI6MjA5NTM5OTk2Mn0.I5G3X-tvrw5ZNwuxXeAVpptNo01gN2SUPsQdTlwHAj0';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variables globales para almacenar configuraciones y datos del reporte
let configHorarioSalida = '17:00';
let configTiempoAlmuerzoMax = 60; // minutos
let datosReporteActual = [];

// Elementos del DOM
const modalPin = document.getElementById('modalPin');
const contenidoAdmin = document.getElementById('contenidoAdmin');
const pinInput = document.getElementById('pinInput');
const btnValidarPin = document.getElementById('btnValidarPin');
const pinError = document.getElementById('pinError');

// ===================================================
// 1. AUTENTICACIÓN POR PIN
// ===================================================
async function cargarConfiguraciones() {
  const { data, error } = await supabase.from('configuracion').select('clave, valor');
  if (error) {
    console.error('Error cargando configuraciones:', error);
    return;
  }
  data.forEach(item => {
    if (item.clave === 'horario_salida_oficial') configHorarioSalida = item.valor;
    if (item.clave === 'tiempo_almuerzo_maximo') configTiempoAlmuerzoMax = parseInt(item.valor, 10);
    if (item.clave === 'pin_admin') window.PIN_CORRECTO = item.valor;
  });
}

btnValidarPin.addEventListener('click', async () => {
  const pinIngresado = pinInput.value.trim();
  // Asegurarse de que las configuraciones estén cargadas
  if (!window.PIN_CORRECTO) {
    await cargarConfiguraciones();
  }
  if (pinIngresado === window.PIN_CORRECTO) {
    modalPin.classList.add('oculto');
    contenidoAdmin.classList.remove('oculto');
    inicializarPanel();
  } else {
    pinError.textContent = 'PIN incorrecto. Intente nuevamente.';
  }
});

// Permitir Enter en el campo PIN
pinInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') btnValidarPin.click();
});

// ===================================================
// 2. INICIALIZACIÓN DEL PANEL
// ===================================================
async function inicializarPanel() {
  await cargarConfiguraciones();
  await listarEmpleados();
  await cargarAreasEnFiltro();
  // Eventos de botones
  document.getElementById('btnRegistrar').addEventListener('click', registrarEmpleado);
  document.getElementById('btnGenerarReporte').addEventListener('click', generarReporte);
  document.getElementById('btnExportarCSV').addEventListener('click', exportarCSV);
}

// ===================================================
// 3. GESTIÓN DE EMPLEADOS (CRUD)
// ===================================================
async function registrarEmpleado() {
  const id = document.getElementById('nuevoId').value.trim();
  const nombre = document.getElementById('nuevoNombre').value.trim();
  const area = document.getElementById('nuevaArea').value.trim();
  const mensaje = document.getElementById('mensajeRegistro');

  if (!id || !nombre) {
    mensaje.textContent = '❌ ID y Nombre son obligatorios.';
    mensaje.style.color = 'red';
    return;
  }

  const { error } = await supabase.from('lista_empleados').insert([
    { id_empleado: id, nombre: nombre, area: area || null }
  ]);

  if (error) {
    mensaje.textContent = `❌ Error: ${error.message}`;
    mensaje.style.color = 'red';
  } else {
    mensaje.textContent = '✅ Empleado registrado exitosamente.';
    mensaje.style.color = 'green';
    document.getElementById('nuevoId').value = '';
    document.getElementById('nuevoNombre').value = '';
    document.getElementById('nuevaArea').value = '';
    listarEmpleados();
  }
}

async function listarEmpleados() {
  const { data, error } = await supabase
    .from('lista_empleados')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    document.getElementById('tablaEmpleados').innerHTML = `<p style="color:red;">Error al cargar empleados.</p>`;
    return;
  }

  let html = `<table>
    <thead><tr><th>ID</th><th>Nombre</th><th>Área</th><th>Estado</th><th>Acción</th></tr></thead><tbody>`;
  data.forEach(emp => {
    html += `<tr>
      <td>${emp.id_empleado}</td>
      <td>${emp.nombre}</td>
      <td>${emp.area || '-'}</td>
      <td>${emp.estado}</td>
      <td>${emp.estado === 'Activo' 
        ? `<button class="danger" data-id="${emp.id_empleado}" onclick="darDeBaja('${emp.id_empleado}')">Dar de Baja</button>` 
        : 'Inactivo'}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('tablaEmpleados').innerHTML = html;
}

async function darDeBaja(idEmpleado) {
  if (!confirm(`¿Confirma dar de baja al empleado ${idEmpleado}?`)) return;

  const { error } = await supabase
    .from('lista_empleados')
    .update({ estado: 'Inactivo' })
    .eq('id_empleado', idEmpleado);

  if (error) {
    alert('Error al actualizar: ' + error.message);
  } else {
    listarEmpleados();
  }
}

// ===================================================
// 4. REPORTES AVANZADOS
// ===================================================
async function cargarAreasEnFiltro() {
  const { data, error } = await supabase
    .from('lista_empleados')
    .select('area')
    .not('area', 'is', null);

  if (error) return;
  const areasUnicas = [...new Set(data.map(item => item.area))].sort();
  const select = document.getElementById('filtroArea');
  areasUnicas.forEach(area => {
    const option = document.createElement('option');
    option.value = area;
    option.textContent = area;
    select.appendChild(option);
  });
}

async function generarReporte() {
  const fechaDesde = document.getElementById('fechaDesde').value;
  const fechaHasta = document.getElementById('fechaHasta').value;
  const areaFiltro = document.getElementById('filtroArea').value;

  // Construir consulta con JOIN
  let query = supabase
    .from('registro_asistencia')
    .select(`
      id_empleado,
      accion,
      timestamp,
      lista_empleados!inner(nombre, area)
    `)
    .order('timestamp', { ascending: true });

  if (fechaDesde) {
    // Ajustar a inicio del día en UTC para comparación
    const desde = new Date(fechaDesde + 'T00:00:00').toISOString();
    query = query.gte('timestamp', desde);
  }
  if (fechaHasta) {
    const hasta = new Date(fechaHasta + 'T23:59:59').toISOString();
    query = query.lte('timestamp', hasta);
  }
  if (areaFiltro) {
    query = query.eq('lista_empleados.area', areaFiltro);
  }

  const { data, error } = await query;

  if (error) {
    document.getElementById('tablaReporte').innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
    return;
  }

  // Procesar datos para cálculos
  datosReporteActual = data.map(reg => ({
    id_empleado: reg.id_empleado,
    nombre: reg.lista_empleados.nombre,
    area: reg.lista_empleados.area,
    accion: reg.accion,
    timestamp: reg.timestamp,
    fechaHora: new Date(reg.timestamp)
  }));

  renderizarTablaReporte(datosReporteActual);
}

function renderizarTablaReporte(datos) {
  // Agrupar por empleado para calcular horas extra y exceso de almuerzo
  const empleados = {};
  datos.forEach(reg => {
    if (!empleados[reg.id_empleado]) {
      empleados[reg.id_empleado] = {
        nombre: reg.nombre,
        area: reg.area,
        registros: [],
        salida: null,
        inicioRefrigerio: null,
        finRefrigerio: null
      };
    }
    empleados[reg.id_empleado].registros.push(reg);
    if (reg.accion === 'Salida') empleados[reg.id_empleado].salida = reg.fechaHora;
    if (reg.accion === 'Inicio Refrigerio') empleados[reg.id_empleado].inicioRefrigerio = reg.fechaHora;
    if (reg.accion === 'Fin Refrigerio') empleados[reg.id_empleado].finRefrigerio = reg.fechaHora;
  });

  // Construir tabla enriquecida
  let html = `<table>
    <thead><tr>
      <th>ID</th><th>Nombre</th><th>Área</th><th>Acción</th><th>Fecha y Hora</th>
      <th>Horas Extra</th><th>Exceso Almuerzo</th>
    </tr></thead><tbody>`;

  datos.forEach(reg => {
    const emp = empleados[reg.id_empleado];
    let horasExtra = '';
    let excesoAlmuerzo = '';

    // Solo calcular en el último registro de Salida por empleado (o en todos)
    if (reg.accion === 'Salida' && emp.salida) {
      const [horaSalidaOficial, minSalidaOficial] = configHorarioSalida.split(':').map(Number);
      const horaLimite = new Date(emp.salida);
      horaLimite.setHours(horaSalidaOficial, minSalidaOficial, 0, 0);
      if (emp.salida > horaLimite) {
        const diffMs = emp.salida - horaLimite;
        const diffMin = Math.floor(diffMs / 60000);
        const h = Math.floor(diffMin / 60);
        const m = diffMin % 60;
        horasExtra = `${h}h ${m}m`;
      } else {
        horasExtra = '0';
      }
    }

    if (reg.accion === 'Fin Refrigerio' && emp.inicioRefrigerio && emp.finRefrigerio) {
      const duracionMs = emp.finRefrigerio - emp.inicioRefrigerio;
      const duracionMin = Math.floor(duracionMs / 60000);
      if (duracionMin > configTiempoAlmuerzoMax) {
        excesoAlmuerzo = `${duracionMin - configTiempoAlmuerzoMax} min extra`;
      }
    }

    const claseExceso = excesoAlmuerzo ? 'alerta' : '';
    html += `<tr class="${claseExceso}">
      <td>${reg.id_empleado}</td>
      <td>${emp.nombre}</td>
      <td>${emp.area || '-'}</td>
      <td>${reg.accion}</td>
      <td>${reg.fechaHora.toLocaleString('es-PE', { timeZone: 'America/Lima' })}</td>
      <td>${horasExtra}</td>
      <td>${excesoAlmuerzo || '✅'}</td>
    </tr>`;
  });

  html += '</tbody></table>';
  document.getElementById('tablaReporte').innerHTML = html;
}

// ===================================================
// 5. EXPORTAR A CSV
// ===================================================
function exportarCSV() {
  if (datosReporteActual.length === 0) {
    alert('No hay datos para exportar. Genere un reporte primero.');
    return;
  }

  const empleados = {};
  datosReporteActual.forEach(reg => {
    if (!empleados[reg.id_empleado]) {
      empleados[reg.id_empleado] = { nombre: reg.nombre, area: reg.area, registros: [], salida: null, inicioRefrigerio: null, finRefrigerio: null };
    }
    empleados[reg.id_empleado].registros.push(reg);
    if (reg.accion === 'Salida') empleados[reg.id_empleado].salida = reg.fechaHora;
    if (reg.accion === 'Inicio Refrigerio') empleados[reg.id_empleado].inicioRefrigerio = reg.fechaHora;
    if (reg.accion === 'Fin Refrigerio') empleados[reg.id_empleado].finRefrigerio = reg.fechaHora;
  });

  let csv = 'ID,Nombre,Área,Acción,Fecha y Hora,Horas Extra,Exceso Almuerzo\n';
  datosReporteActual.forEach(reg => {
    const emp = empleados[reg.id_empleado];
    let horasExtra = '';
    let excesoAlmuerzo = '';
    if (reg.accion === 'Salida' && emp.salida) {
      const [horaSalidaOficial, minSalidaOficial] = configHorarioSalida.split(':').map(Number);
      const horaLimite = new Date(emp.salida);
      horaLimite.setHours(horaSalidaOficial, minSalidaOficial, 0, 0);
      if (emp.salida > horaLimite) {
        const diffMin = Math.floor((emp.salida - horaLimite) / 60000);
        horasExtra = `${Math.floor(diffMin/60)}h ${diffMin%60}m`;
      }
    }
    if (reg.accion === 'Fin Refrigerio' && emp.inicioRefrigerio && emp.finRefrigerio) {
      const duracionMin = Math.floor((emp.finRefrigerio - emp.inicioRefrigerio) / 60000);
      if (duracionMin > configTiempoAlmuerzoMax) excesoAlmuerzo = `${duracionMin - configTiempoAlmuerzoMax} min`;
    }
    csv += `${reg.id_empleado},${emp.nombre},${emp.area || ''},${reg.accion},${reg.fechaHora.toLocaleString('es-PE')},${horasExtra},${excesoAlmuerzo || 'OK'}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reporte_asistencia_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}