// ============================================================
// 📄 reportesCalificaciones.js
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

// ============================================================
// 🧠 Función principal
// ============================================================
export async function abrirReporteCalificaciones() {
  // 🟢 Crear overlay y modal
  const overlay = document.createElement("div");
  overlay.className = "rep-overlay";

  const modal = document.createElement("div");
  modal.className = "rep-modal";
  modal.innerHTML = `
    <div class="rep-header">
      <h2 style="flex:1;text-align:center;">REPORTE • CALIFICACIONES</h2>
      <button class="rep-close">❌</button>
    </div>

    <div class="rep-filters">
      <div class="rep-group">
        <button class="pill-btn active" data-scope="dia">Por día</button>
        <button class="pill-btn" data-scope="todo">Todo</button>
      </div>

      <div class="rep-group">
        <label>Fecha</label>
        <input type="date" id="repFechaCalif" />
      </div>

      <div class="rep-actions">
        <button class="btn" id="btnExportarCalif">Exportar</button>
      </div>
    </div>

    <div class="rep-table-wrap">
      <table class="rep-table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Limpieza</th>
            <th>Presentación</th>
            <th>Rapidez</th>
            <th>Solución</th>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Identificador</th>
            <th>Placa/DNI</th>
            <th>Sector</th>
          </tr>
        </thead>
        <tbody id="repCalifBody">
          <tr><td colspan="10" class="rep-empty">Sin resultados.</td></tr>
        </tbody>
      </table>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Botón cerrar
  modal.querySelector(".rep-close").addEventListener("click", () => overlay.remove());

  // === Inicializar valores ===
  const fechaInput = modal.querySelector("#repFechaCalif");
  fechaInput.value = new Date().toISOString().slice(0, 10);

  let modo = "dia";

  // === Listeners ===
  modal.querySelectorAll(".pill-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      modal.querySelectorAll(".pill-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      modo = btn.dataset.scope;
      await cargarDatosCalificaciones();
    });
  });

  fechaInput.addEventListener("change", cargarDatosCalificaciones);
  modal.querySelector("#btnExportarCalif").addEventListener("click", exportarCSV);

  // === Cargar al abrir ===
  await cargarDatosCalificaciones();

  // ============================================================
  // 🔍 Función de carga
  // ============================================================
  async function cargarDatosCalificaciones() {
    const fechaSeleccionada = fechaInput.value.split("-").reverse().join("-");
    const cuerpo = modal.querySelector("#repCalifBody");
    cuerpo.innerHTML = `<tr><td colspan="10" class="rep-empty">Cargando...</td></tr>`;

    let registros = [];

    try {
      let q;
      if (modo === "todo") {
        q = query(collectionGroup(db, "respuestas"), orderBy("timestamp", "desc"), limit(1000));
      } else {
        q = query(
          collectionGroup(db, "respuestas"),
          where("fecha", "==", fechaSeleccionada),
          orderBy("timestamp", "desc")
        );
      }

      const snap = await getDocs(q);
      snap.forEach(doc => {
        const d = doc.data();
        if (d && d.calificaciones) registros.push(d);
      });

      if (registros.length === 0) {
        cuerpo.innerHTML = `<tr><td colspan="10" class="rep-empty">Sin resultados.</td></tr>`;
        return;
      }

      registros.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));

      cuerpo.innerHTML = registros.map(d => `
        <tr>
          <td>${d.nombre_usuario || ""}</td>
          <td>${d.calificaciones.limpieza ?? ""}</td>
          <td>${d.calificaciones.presentacion ?? ""}</td>
          <td>${d.calificaciones.rapidez ?? ""}</td>
          <td>${d.calificaciones.solucion ?? ""}</td>
          <td>${d.fecha || ""}</td>
          <td>${d.hora || ""}</td>
          <td>${d.identificador || ""}</td>
          <td>${d.placa_dni || ""}</td>
          <td>${d.sector_cargo || ""}</td>
        </tr>
      `).join("");

    } catch (err) {
      console.error("❌ Error al cargar calificaciones:", err);
      cuerpo.innerHTML = `<tr><td colspan="10" class="rep-empty">Error al obtener datos.</td></tr>`;
    }
  }

  // ============================================================
  // 💾 Exportar CSV
  // ============================================================
  function exportarCSV() {
    const filas = modal.querySelectorAll("#repCalifBody tr");
    if (filas.length === 0 || filas[0].querySelector(".rep-empty")) {
      alert("No hay datos para exportar.");
      return;
    }

    let csv = "Usuario;Limpieza;Presentación;Rapidez;Solución;Fecha;Hora;Identificador;Placa/DNI;Sector\n";
    filas.forEach(tr => {
      const celdas = Array.from(tr.querySelectorAll("td")).map(td => `"${td.textContent.trim()}"`);
      csv += celdas.join(";") + "\n";
    });

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reporte_calificaciones.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
}
