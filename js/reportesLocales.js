// ============================================================
// 📄 reportesLocales.js — MSI v1.0 (Optimizado y compatible con índices existentes)
// ============================================================

import { db } from "./firebase.js";
import {
  collectionGroup,
  query,
  where,
  orderBy,
  getDocs,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getTurnoYFecha } from "./turno.js";

// ============================================================
// 🧠 FUNCIÓN PRINCIPAL
// ============================================================
export async function abrirReporteLocales() {
  // 🟢 Crear overlay y modal
  const overlay = document.createElement("div");
  overlay.className = "rep-overlay";

  const modal = document.createElement("div");
  modal.className = "rep-modal";
  modal.style.width = "90%";
  modal.innerHTML = `
    <div class="rep-header">
      <h2 id="repTituloLocales" style="flex:1;text-align:center;">REPORTE • LOCALES — CARGANDO...</h2>
      <button class="rep-close">❌</button>
    </div>

    <div class="rep-filters">
      <div class="rep-group">
        <button class="pill-btn active" data-scope="dia">Por día</button>
        <button class="pill-btn" data-scope="todo">Todo</button>
      </div>

      <div class="rep-group">
        <label>Fecha</label>
        <input type="date" id="repFechaLocales" />
        <button id="btnActualLocales" class="btn">Actual</button>
      </div>

      <div class="rep-group rep-turnos">
        <label>Turno</label>
        <div>
          <button class="t-btn" data-turno="TI">TI</button>
          <button class="t-btn" data-turno="T2">T2</button>
          <button class="t-btn" data-turno="T3">T3</button>
        </div>
      </div>

      <div class="rep-actions">
        <button class="btn" id="btnExportarLocales">Exportar</button>
      </div>
    </div>

    <div class="rep-table-wrap">
      <table class="rep-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Dirección</th>
            <th>ID Local</th>
            <th>Supervisor</th>
            <th>Supervisor DNI</th>
            <th>Comentario</th>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Turno</th>
            <th>Sector</th>
            <th>Lat</th>
            <th>Lng</th>
          </tr>
        </thead>
        <tbody id="repLocalesBody">
          <tr><td colspan="11" class="rep-empty">Sin resultados.</td></tr>
        </tbody>
      </table>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Cerrar modal
  modal.querySelector(".rep-close").addEventListener("click", () => overlay.remove());

  // Inicializar fecha y turno
  const { fechaISO, turno } = getTurnoYFecha();
  const fechaInput = modal.querySelector("#repFechaLocales");
  fechaInput.value = fechaISO;

  let turnoActivo = turno;
  let modo = "dia";

  const cuerpo = modal.querySelector("#repLocalesBody");
  const titulo = modal.querySelector("#repTituloLocales");

  actualizarTurnoActivo();

  // ============================================================
  // 🎯 EVENTOS DE BOTONES
  // ============================================================

  modal.querySelectorAll(".t-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      modal.querySelectorAll(".t-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      turnoActivo = btn.dataset.turno;
      actualizarTitulo();
      await cargarDatosLocales();
    });
  });

  modal.querySelectorAll(".pill-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      modal.querySelectorAll(".pill-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      modo = btn.dataset.scope;
      actualizarTitulo();
      await cargarDatosLocales();
    });
  });

  modal.querySelector("#btnActualLocales").addEventListener("click", async () => {
    const hoy = new Date();
    fechaInput.value = hoy.toISOString().slice(0, 10);
    const { turno } = getTurnoYFecha();
    turnoActivo = turno;
    actualizarTurnoActivo();
    actualizarTitulo();
    await cargarDatosLocales();
  });

  fechaInput.addEventListener("change", async () => {
    actualizarTitulo();
    await cargarDatosLocales();
  });

  modal.querySelector("#btnExportarLocales").addEventListener("click", exportarCSV);

  // Cargar datos iniciales
  actualizarTitulo();
  await cargarDatosLocales();

  // ============================================================
  // 🔍 FUNCIÓN DE CARGA
  // ============================================================
  async function cargarDatosLocales() {
    cuerpo.innerHTML = `<tr><td colspan="11" class="rep-empty">Cargando...</td></tr>`;
    const fechaSeleccionada = fechaInput.value.split("-").reverse().join("-");
    const registros = [];

    try {
      if (modo === "todo") {
        // 🟡 Histórico completo optimizado
        const q = query(collectionGroup(db, "registros"), orderBy("timestamp", "desc"), limit(2000));
        const snap = await getDocs(q);
        snap.forEach(doc => {
          const d = doc.data();
          if (d.idLocal && d.nombre && d.fecha) registros.push(d);
        });
      } else {
        // 🟢 Día y turno seleccionado
        const filtros = [];
        if (turnoActivo === "T3") {
          filtros.push("T3-I", "T3-II");
        } else {
          filtros.push(turnoActivo);
        }

        const consultas = filtros.map(turno =>
          query(
            collectionGroup(db, "registros"),
            where("fecha", "==", fechaSeleccionada.replace(/-/g, "/")),
            where("turno", "==", turno),
            orderBy("timestamp", "desc")
          )
        );

        const snapshots = await Promise.all(consultas.map(q => getDocs(q)));
        snapshots.forEach(snap => {
          snap.forEach(doc => {
            const d = doc.data();
            if (d.idLocal && d.nombre && d.fecha) registros.push(d);
          });
        });
      }

      if (registros.length === 0) {
        cuerpo.innerHTML = `<tr><td colspan="11" class="rep-empty">Sin resultados.</td></tr>`;
        return;
      }

      // Ordenar descendente
      registros.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));

      // Renderizar tabla
      cuerpo.innerHTML = registros
        .map(
          d => `
        <tr>
          <td>${d.nombre || ""}</td>
          <td>${d.direccion || ""}</td>
          <td>${d.idLocal || ""}</td>
          <td>${d.supervisor_nombre || ""}</td>
          <td>${d.supervisor_dni || ""}</td>
          <td>${d.comentario || "—"}</td>
          <td>${d.fecha || ""}</td>
          <td>${d.hora || ""}</td>
          <td>${d.turno || ""}</td>
          <td>${d.sector || ""}</td>
          <td>${d.lat?.toFixed?.(6) || ""}</td>
          <td>${d.lng?.toFixed?.(6) || ""}</td>
        </tr>`
        )
        .join("");
    } catch (err) {
      console.error("❌ Error al cargar locales:", err);
      cuerpo.innerHTML = `<tr><td colspan="11" class="rep-empty">Error al obtener datos.</td></tr>`;
    }
  }

  // ============================================================
  // 💾 EXPORTAR CSV
  // ============================================================
  function exportarCSV() {
    const filas = modal.querySelectorAll("#repLocalesBody tr");
    if (filas.length === 0 || filas[0].querySelector(".rep-empty")) {
      alert("No hay datos para exportar.");
      return;
    }

    let csv =
      "Nombre;Dirección;ID Local;Supervisor;Supervisor DNI;Comentario;Fecha;Hora;Turno;Sector;Lat;Lng\n";

    filas.forEach(tr => {
      const celdas = Array.from(tr.querySelectorAll("td")).map(td => `"${td.textContent.trim()}"`);
      csv += celdas.join(";") + "\n";
    });

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reporte_locales.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ============================================================
  // 🎯 UTILIDADES
  // ============================================================
  function actualizarTurnoActivo() {
    modal.querySelectorAll(".t-btn").forEach(b => b.classList.remove("active"));
    const btn = modal.querySelector(`.t-btn[data-turno="${turnoActivo}"]`);
    if (btn) btn.classList.add("active");
  }

  function actualizarTitulo() {
    if (modo === "todo")
      titulo.textContent = "REPORTE • LOCALES — HISTORIAL COMPLETO";
    else
      titulo.textContent = `REPORTE • LOCALES — TURNO ${turnoActivo}`;
  }
}
