// ===================================================
// CONFIGURACIÓN DE SUPABASE
// Reemplaza con tus credenciales reales del proyecto
// ===================================================
const SUPABASE_URL = 'https://pewiapusktjtjttxgdwg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBld2lhcHVza3RqdGp0dHhnZHdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjM5NjIsImV4cCI6MjA5NTM5OTk2Mn0.I5G3X-tvrw5ZNwuxXeAVpptNo01gN2SUPsQdTlwHAj0';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elementos del DOM
const idEmpleadoInput = document.getElementById('idEmpleado');
const mensajeMarcaje = document.getElementById('mensajeMarcaje');
const idConsultaInput = document.getElementById('idConsulta');
const btnConsultar = document.getElementById('btnConsultar');
const tablaRegistros = document.getElementById('tablaRegistros');

// ===================================================
// FUNCIÓN: Mostrar mensaje temporal
// ===================================================
function mostrarMensaje(elemento, texto, tipo) {
  elemento.textContent = texto;
  elemento.className = `mensaje ${tipo}`;
  setTimeout(() => {
    elemento.textContent = '';
    elemento.className = 'mensaje';
  }, 4000);
}

// ===================================================
// FUNCIÓN: Validar empleado activo
// ===================================================
async function validarEmpleadoActivo(id) {
  const { data, error } = await supabase
    .from('lista_empleados')
    .select('id_empleado, estado')
    .eq('id_empleado', id)
    .maybeSingle();

  if (error) {
    console.error('Error al validar empleado:', error);
    throw new Error('Error de conexión al validar empleado.');
  }
  if (!data) {
    throw new Error('El ID de empleado no existe.');
  }
  if (data.estado !== 'Activo') {
    throw new Error('El empleado no está activo. Contacte a administración.');
  }
  return data;
}

// ===================================================
// FUNCIÓN: Registrar marcaje
// ===================================================
async function registrarMarcaje(accion) {
  const id = idEmpleadoInput.value.trim();
  if (!id) {
    mostrarMensaje(mensajeMarcaje, 'Por favor, ingrese su ID de empleado.', 'error');
    return;
  }

  try {
    // Verificar que el empleado existe y está activo
    await validarEmpleadoActivo(id);

    // Insertar registro (timestamp lo genera la BD)
    const { error: insertError } = await supabase
      .from('registro_asistencia')
      .insert([{ id_empleado: id, accion: accion }]);

    if (insertError) throw insertError;

    mostrarMensaje(mensajeMarcaje, `✅ Marcaje "${accion}" registrado con éxito.`, 'exito');
  } catch (error) {
    mostrarMensaje(mensajeMarcaje, `❌ ${error.message}`, 'error');
  }
}

// ===================================================
// FUNCIÓN: Consultar registros del mes actual
// ===================================================
async function consultarRegistrosMes() {
  const id = idConsultaInput.value.trim();
  if (!id) {
    tablaRegistros.innerHTML = '<p style="text-align:center; color:red;">Ingrese un ID para consultar.</p>';
    return;
  }

  try {
    // Calcular inicio y fin del mes actual en UTC para comparar con timestamptz
    const ahora = new Date();
    const inicioMes = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), 1)).toISOString();
    const finMes = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59)).toISOString();

    const { data, error } = await supabase
      .from('registro_asistencia')
      .select('id_empleado, accion, timestamp')
      .eq('id_empleado', id)
      .gte('timestamp', inicioMes)
      .lte('timestamp', finMes)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      tablaRegistros.innerHTML = '<p style="text-align:center;">Sin registros este mes.</p>';
      return;
    }

    // Construir tabla HTML
    let html = `<table>
      <thead><tr><th>Fecha y Hora</th><th>Acción</th></tr></thead>
      <tbody>`;
    data.forEach(reg => {
      const fecha = new Date(reg.timestamp).toLocaleString('es-PE', { timeZone: 'America/Lima' });
      html += `<tr><td>${fecha}</td><td>${reg.accion}</td></tr>`;
    });
    html += '</tbody></table>';
    tablaRegistros.innerHTML = html;
  } catch (error) {
    tablaRegistros.innerHTML = `<p style="color:red; text-align:center;">Error: ${error.message}</p>`;
  }
}

// ===================================================
// ASIGNACIÓN DE EVENTOS
// ===================================================
document.querySelectorAll('[data-accion]').forEach(boton => {
  boton.addEventListener('click', (e) => {
    const accion = e.target.getAttribute('data-accion');
    registrarMarcaje(accion);
  });
});

btnConsultar.addEventListener('click', consultarRegistrosMes);

// Permitir consulta al presionar Enter en campo de consulta
idConsultaInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') consultarRegistrosMes();
});