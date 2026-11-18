const alertaEl = document.getElementById("alerta");

function mostrarAlerta(mensaje, tipo = "ok") {
  alertaEl.textContent = mensaje;
  alertaEl.className = `alerta ${tipo}`;
  setTimeout(() => {
    alertaEl.className = "alerta oculto";
  }, 5500);
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Error HTTP ${res.status}`);
  return data;
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".vista").forEach((v) => v.classList.remove("activa"));
    btn.classList.add("active");
    document.getElementById(`vista-${btn.dataset.tab}`).classList.add("activa");
    cargarTodo();
  });
});

async function cargarSelectsPrestamo() {
  const [equiposDisp, usuariosAct] = await Promise.all([
    apiFetch("/api/equipos?estado=disponible"),
    apiFetch("/api/usuarios?activo=true"),
  ]);
  const selEq = document.getElementById("prestamo-equipo");
  selEq.innerHTML = equiposDisp.length
    ? equiposDisp.map((e) => `<option value="${e._id}">${e.codigo} — ${e.nombre} (${e.categoria})</option>`).join("")
    : `<option value="">No hay equipos disponibles</option>`;
  const selUsr = document.getElementById("prestamo-usuario");
  selUsr.innerHTML = usuariosAct.length
    ? usuariosAct.map((u) => `<option value="${u._id}">${u.nombre} (${u.tipo})</option>`).join("")
    : `<option value="">No hay usuarios activos</option>`;
}

async function cargarPrestamos() {
  const soloVencidos = document.getElementById("filtro-solo-vencidos").checked;
  const url = soloVencidos ? "/api/prestamos?estado=activo&vencidos=true" : "/api/prestamos?estado=activo";
  const prestamos = await apiFetch(url);
  const tbody = document.getElementById("tabla-prestamos");
  if (!prestamos.length) {
    tbody.innerHTML = `<tr><td colspan="5">No hay préstamos para mostrar.</td></tr>`;
    return;
  }
  tbody.innerHTML = prestamos.map((p) => {
    const fechaStr = new Date(p.fechaLimite).toLocaleString("es-CO");
    const estadoBadge = p.vencido
      ? `<span class="badge badge-vencido">VENCIDO</span>`
      : `<span class="badge badge-prestado">ACTIVO</span>`;
    return `<tr class="${p.vencido ? "fila-vencida" : ""}">
      <td><strong>${p.equipo?.codigo || ""}</strong> ${p.equipo?.nombre || ""}</td>
      <td>${p.usuario?.nombre || ""} <small>(${p.usuario?.tipo || ""})</small></td>
      <td>${fechaStr}</td>
      <td>${estadoBadge}</td>
      <td><button class="btn-sm btn-success" onclick="devolverPrestamo('${p._id}')">Devolver</button></td>
    </tr>`;
  }).join("");
}

window.devolverPrestamo = async function (id) {
  try {
    await apiFetch(`/api/prestamos/${id}/devolver`, { method: "PATCH" });
    mostrarAlerta("Equipo devuelto correctamente y marcado como disponible.", "ok");
    await cargarTodo();
  } catch (err) { mostrarAlerta(err.message, "error"); }
};

document.getElementById("form-prestamo").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await apiFetch("/api/prestamos", {
      method: "POST",
      body: JSON.stringify({
        equipoId: document.getElementById("prestamo-equipo").value,
        usuarioId: document.getElementById("prestamo-usuario").value,
        fechaLimite: new Date(document.getElementById("prestamo-fecha").value).toISOString(),
        observaciones: document.getElementById("prestamo-obs").value.trim(),
      }),
    });
    e.target.reset();
    mostrarAlerta("Préstamo registrado con éxito.", "ok");
    await cargarTodo();
  } catch (err) { mostrarAlerta(err.message, "error"); }
});

document.getElementById("filtro-solo-vencidos").addEventListener("change", () => {
  cargarPrestamos().catch((err) => mostrarAlerta(err.message, "error"));
});

async function cargarEquipos() {
  const estado = document.getElementById("filtro-eq-estado").value;
  const url = estado ? `/api/equipos?estado=${estado}` : "/api/equipos";
  const equipos = await apiFetch(url);
  const tbody = document.getElementById("tabla-equipos");
  tbody.innerHTML = equipos.map((eq) => {
    const siguienteEstado = eq.estado === "disponible" ? "mantenimiento" : "disponible";
    const textoBtn = eq.estado === "disponible" ? "A mantenimiento" : "A disponible";
    const acciones = eq.estado === "prestado"
      ? `<small>En préstamo activo</small>`
      : `<button class="btn-sm" onclick="cambiarEstadoEquipo('${eq._id}', '${siguienteEstado}')">${textoBtn}</button>
         <button class="btn-sm btn-danger" onclick="eliminarEquipo('${eq._id}')">Eliminar</button>`;
    return `<tr>
      <td><strong>${eq.codigo}</strong></td>
      <td>${eq.nombre}</td>
      <td>${eq.categoria}</td>
      <td>${eq.ubicacion}</td>
      <td><span class="badge badge-${eq.estado}">${eq.estado}</span></td>
      <td>${acciones}</td>
    </tr>`;
  }).join("");
}

window.cambiarEstadoEquipo = async function (id, estado) {
  try {
    await apiFetch(`/api/equipos/${id}`, { method: "PUT", body: JSON.stringify({ estado }) });
    mostrarAlerta(`Estado del equipo actualizado a '${estado}'.`, "ok");
    await cargarTodo();
  } catch (err) { mostrarAlerta(err.message, "error"); }
};

window.eliminarEquipo = async function (id) {
  try {
    await apiFetch(`/api/equipos/${id}`, { method: "DELETE" });
    mostrarAlerta("Equipo eliminado correctamente.", "ok");
    await cargarTodo();
  } catch (err) { mostrarAlerta(err.message, "error"); }
};

document.getElementById("form-equipo").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await apiFetch("/api/equipos", {
      method: "POST",
      body: JSON.stringify({
        codigo: document.getElementById("eq-codigo").value,
        nombre: document.getElementById("eq-nombre").value,
        categoria: document.getElementById("eq-categoria").value,
        estado: document.getElementById("eq-estado").value,
        ubicacion: document.getElementById("eq-ubicacion").value,
      }),
    });
    e.target.reset();
    mostrarAlerta("Equipo creado correctamente.", "ok");
    await cargarTodo();
  } catch (err) { mostrarAlerta(err.message, "error"); }
});

document.getElementById("filtro-eq-estado").addEventListener("change", () => {
  cargarEquipos().catch((err) => mostrarAlerta(err.message, "error"));
});

async function cargarUsuarios() {
  const usuarios = await apiFetch("/api/usuarios");
  document.getElementById("tabla-usuarios").innerHTML = usuarios.map((u) => `<tr>
    <td>${u.nombre}</td>
    <td>${u.documento}</td>
    <td>${u.email}</td>
    <td>${u.tipo}</td>
    <td><span class="badge ${u.activo ? "badge-disponible" : "badge-mantenimiento"}">${u.activo ? "Activo" : "Inactivo"}</span></td>
    <td><button class="btn-sm btn-danger" onclick="eliminarUsuario('${u._id}')">Eliminar</button></td>
  </tr>`).join("");
}

window.eliminarUsuario = async function (id) {
  try {
    await apiFetch(`/api/usuarios/${id}`, { method: "DELETE" });
    mostrarAlerta("Usuario eliminado correctamente.", "ok");
    await cargarTodo();
  } catch (err) { mostrarAlerta(err.message, "error"); }
};

document.getElementById("form-usuario").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await apiFetch("/api/usuarios", {
      method: "POST",
      body: JSON.stringify({
        nombre: document.getElementById("usr-nombre").value,
        documento: document.getElementById("usr-documento").value,
        email: document.getElementById("usr-email").value,
        tipo: document.getElementById("usr-tipo").value,
        activo: document.getElementById("usr-activo").checked,
      }),
    });
    e.target.reset();
    document.getElementById("usr-activo").checked = true;
    mostrarAlerta("Usuario registrado correctamente.", "ok");
    await cargarTodo();
  } catch (err) { mostrarAlerta(err.message, "error"); }
});

async function cargarReportes() {
  const [resumen, top] = await Promise.all([
    apiFetch("/api/reportes/resumen"),
    apiFetch("/api/reportes/top-equipos?limit=5"),
  ]);
  document.getElementById("kpi-resumen").innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Equipos disponibles</div><div class="kpi-value">${resumen.equiposPorEstado.disponible}</div></div>
    <div class="kpi-card"><div class="kpi-label">Equipos prestados</div><div class="kpi-value">${resumen.equiposPorEstado.prestado}</div></div>
    <div class="kpi-card"><div class="kpi-label">En mantenimiento</div><div class="kpi-value">${resumen.equiposPorEstado.mantenimiento}</div></div>
    <div class="kpi-card"><div class="kpi-label">Préstamos activos</div><div class="kpi-value">${resumen.prestamosActivos}</div></div>
    <div class="kpi-card"><div class="kpi-label">Préstamos vencidos</div><div class="kpi-value" style="color:#991b1b">${resumen.prestamosVencidos}</div></div>`;
  const porTipo = resumen.prestamosActivosPorTipoUsuario;
  document.getElementById("tabla-por-tipo").innerHTML = `
    <tr><td>Estudiante</td><td><strong>${porTipo.estudiante}</strong></td></tr>
    <tr><td>Docente</td><td><strong>${porTipo.docente}</strong></td></tr>
    <tr><td>Administrativo</td><td><strong>${porTipo.administrativo}</strong></td></tr>`;
  document.getElementById("tabla-top-equipos").innerHTML = top.length
    ? top.map((item) => `<tr><td><strong>${item.codigo}</strong></td><td>${item.nombre}</td><td><strong>${item.totalPrestamos}</strong></td></tr>`).join("")
    : `<tr><td colspan="3">Sin historial de préstamos aún.</td></tr>`;
}

async function cargarTodo() {
  try {
    await Promise.all([cargarSelectsPrestamo(), cargarPrestamos(), cargarEquipos(), cargarUsuarios(), cargarReportes()]);
  } catch (err) { mostrarAlerta(err.message, "error"); }
}

cargarTodo();
