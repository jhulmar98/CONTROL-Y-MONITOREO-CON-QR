// ============================================================
// REPORTE • SERENOS — versión final con soporte UTF-8 y supervisor DNI
// ============================================================

import { db } from "./firebase.js";
import {
  collectionGroup, query, where, orderBy, limit, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getTurnoYFecha } from "./turno.js";

/* ======================= Helpers de fecha ======================= */
function normDMY(input) {
  if (!input) return null;
  const s = String(input).trim();
  let dd, mm, yyyy;
  if (s.includes("-")) {
    const p = s.split("-");
    if (p[0].length === 4) [yyyy, mm, dd] = p; else [dd, mm, yyyy] = p;
  } else return null;
  return `${String(dd).padStart(2,"0")}-${String(mm).padStart(2,"0")}-${yyyy}`;
}
function dmyToNext(dmy) {
  const [dd, mm, yyyy] = dmy.split("-");
  const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
}

/* ======================= Modal HTML ======================= */
const modalHTML = `
<div id="repOverlay" class="rep-overlay" style="display:none;">
  <div class="rep-modal">
    <div class="rep-header">
      <h3 id="repTitulo">REPORTE • SERENOS</h3>
      <button id="repClose" class="rep-close">✖</button>
    </div>

    <div class="rep-filters">
      <div class="rep-group">
        <div class="rep-pill">
          <button class="pill-btn active" data-modo="DIA">Por día</button>
          <button class="pill-btn" data-modo="TODO">Todo</button>
        </div>
      </div>

      <div class="rep-group">
        <label>Fecha</label>
        <div class="rep-date-row">
          <input type="date" id="repFecha"/>
          <button id="repActual" class="mini-btn">Actual</button>
        </div>
      </div>

      <div class="rep-group">
        <label>Turno</label>
        <div class="rep-turnos">
          <button class="t-btn" data-turno="TI">TI</button>
          <button class="t-btn" data-turno="T2">T2</button>
          <button class="t-btn" data-turno="T3">T3</button>
        </div>
      </div>

      <div class="rep-actions">
        <button id="repExport" class="btn">Exportar</button>
      </div>
    </div>

    <div class="rep-table-wrap">
      <table class="rep-table" id="repTable">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>DNI</th>
            <th>Cargo</th>
            <th>Supervisor</th>
            <th>Supervisor DNI</th>
            <th>Comentario</th>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Turno</th>
            <th>Lat</th>
            <th>Lng</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
      <div class="rep-empty" id="repEmpty" style="display:none;">Sin resultados.</div>
    </div>
  </div>
</div>
`;
document.body.insertAdjacentHTML("beforeend", modalHTML);

/* ======================= Estado/UI ======================= */
const repOverlay = document.getElementById("repOverlay");
const repClose   = document.getElementById("repClose");
const repFecha   = document.getElementById("repFecha");
const repActual  = document.getElementById("repActual");
const repExport  = document.getElementById("repExport");
const repTitulo  = document.getElementById("repTitulo");
const pillBtns   = Array.from(document.querySelectorAll(".pill-btn"));
const turnoBtns  = Array.from(document.querySelectorAll(".t-btn"));

let modo = "DIA";
let turnoSel = "auto";
let rowsActuales = [];

/* ======================= Inicialización ======================= */
(function initDefault() {
  const { fechaISO } = getTurnoYFecha(new Date());
  repFecha.value = fechaISO;
})();

/* ------- helpers UI ------- */
function setModo(nuevo) {
  modo = nuevo;
  pillBtns.forEach(x => x.classList.toggle("active", x.dataset.modo === nuevo));
}
function activarTurnoUI(turnoSimple) {
  turnoBtns.forEach(b => b.classList.toggle("active", b.dataset.turno === turnoSimple));
  turnoSel = turnoSimple;
}

/* ------- eventos ------- */
repClose.addEventListener("click", () => repOverlay.style.display = "none");

pillBtns.forEach(b => b.addEventListener("click", () => {
  setModo(b.dataset.modo);
  consultar();
}));

turnoBtns.forEach(b => b.addEventListener("click", () => {
  activarTurnoUI(b.dataset.turno);
  consultar();
}));

repFecha.addEventListener("change", consultar);

repActual.addEventListener("click", () => {
  const { fechaISO, turno } = getTurnoYFecha(new Date());
  repFecha.value = fechaISO;
  setModo("DIA");
  activarTurnoUI(turno.startsWith("T3") ? "T3" : turno);
  consultar();
});

/* ======================= CONSULTA PRINCIPAL ======================= */
async function consultar() {
  rowsActuales = [];
  const tbody = document.querySelector("#repTable tbody");
  const empty = document.getElementById("repEmpty");
  tbody.innerHTML = "";
  empty.style.display = "none";

  const { turno, fechaNormal } = getTurnoYFecha(new Date());
  const fechaBase = repFecha.value || fechaNormal;
  const dmy = normDMY(fechaBase);
  const nextDmy = dmyToNext(dmy);

  let turnoEfectivo = turnoSel === "auto" ? turno : turnoSel;
  if (turnoEfectivo.startsWith("T3")) turnoEfectivo = "T3";

  repTitulo.textContent =
    `REPORTE • SERENOS — ${modo === "TODO" ? "HISTORIAL COMPLETO" : "TURNO " + turnoEfectivo}`;

  try {
    if (modo === "TODO") {
      // 🔹 Traer todo el historial desde asistencias/*
      let snap;
      try {
        const q1 = query(
          collectionGroup(db, "registros"),
          orderBy("timestamp", "desc"),
          limit(10000)
        );
        snap = await getDocs(q1);
      } catch (err) {
        console.warn("⚠️ fallback sin orderBy:", err?.code || err);
        snap = await getDocs(query(collectionGroup(db, "registros"), limit(10000)));
      }

      snap.forEach(docSnap => {
        const d = docSnap.data() || {};
        if (!docSnap.ref.path.includes("asistencias")) return;
        rowsActuales.push({
          nombre: d.nombre || "",
          dni: d.dni || "",
          cargo: d.cargo || "",
          supervisor: d.supervisor_nombre || d.supervisor || "",
          supervisor_dni: d.supervisor_dni || "",
          comentario: d.comentario || "",
          fecha: d.fecha || "",
          hora: d.hora || "",
          turno: d.turno || "",
          lat: d.lat ?? "",
          lng: d.lng ?? ""
        });
      });
    } else {
      // 🔹 Filtrar por fecha y turno
      const consultas = [];
      const push = (fechaCampo, turnoCampo) => {
        consultas.push(query(
          collectionGroup(db, "registros"),
          where("fecha", "==", fechaCampo),
          where("turno", "==", turnoCampo),
          orderBy("timestamp", "desc"),
          limit(1500)
        ));
      };

      if (turnoEfectivo === "T3") {
        push(dmy, "T3-I");
        push(nextDmy, "T3-II");
      } else {
        push(dmy, turnoEfectivo);
      }

      const snaps = await Promise.all(consultas.map(getDocs));
      for (const s of snaps) {
        s.forEach(docSnap => {
          const d = docSnap.data() || {};
          if (!docSnap.ref.path.includes("asistencias")) return;
          rowsActuales.push({
            nombre: d.nombre || "",
            dni: d.dni || "",
            cargo: d.cargo || "",
            supervisor: d.supervisor_nombre || d.supervisor || "",
            supervisor_dni: d.supervisor_dni || "",
            comentario: d.comentario || "",
            fecha: d.fecha || "",
            hora: d.hora || "",
            turno: d.turno || "",
            lat: d.lat ?? "",
            lng: d.lng ?? ""
          });
        });
      }
    }
  } catch (e) {
    console.error("❌ Error consultando registros:", e);
  }

  // 🔹 Ordenar correctamente por fecha + hora (descendente)
  rowsActuales.sort((a, b) => {
    const parse = (r) => {
      const [dd, mm, yyyy] = (r.fecha || "00-00-0000").split("-");
      const h = r.hora || "00:00:00";
      return new Date(`${yyyy}-${mm}-${dd}T${h}`);
    };
    return parse(b) - parse(a);
  });

  if (!rowsActuales.length) {
    empty.style.display = "block";
    return;
  }

  const frag = document.createDocumentFragment();
  for (const r of rowsActuales) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.nombre}</td>
      <td>${r.dni}</td>
      <td>${r.cargo}</td>
      <td>${r.supervisor}</td>
      <td>${r.supervisor_dni}</td>
      <td>${r.comentario || "—"}</td>
      <td>${r.fecha}</td>
      <td>${r.hora}</td>
      <td>${r.turno}</td>
      <td>${r.lat}</td>
      <td>${r.lng}</td>
    `;
    frag.appendChild(tr);
  }
  tbody.appendChild(frag);
}

/* ======================= EXPORTAR CSV ======================= */
function exportCSV() {
  if (!rowsActuales.length) return;
  const headers = [
    "Nombre","DNI","Cargo","Supervisor","Supervisor DNI",
    "Comentario","Fecha","Hora","Turno","Lat","Lng"
  ];
  const csvRows = [headers.join(";")];

  for (const r of rowsActuales) {
    const row = [
      r.nombre, r.dni, r.cargo, r.supervisor, r.supervisor_dni,
      (r.comentario||"").replace(/\n/g," ").replace(/;/g,","), // evitar romper celdas
      r.fecha, r.hora, r.turno, r.lat, r.lng
    ].map(v => `"${String(v).replace(/"/g,'""')}"`);
    csvRows.push(row.join(";"));
  }

  // ✅ BOM UTF-8 para soportar tildes y ñ
  const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reporte_serenos_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
repExport.addEventListener("click", exportCSV);

/* ======================= ABRIR MODAL ======================= */
function abrirReporteSerenos() {
  const { fechaISO, turno } = getTurnoYFecha(new Date());
  repFecha.value = fechaISO;
  setModo("DIA");
  const simple = turno.startsWith("T3") ? "T3" : turno;
  activarTurnoUI(simple);
  repOverlay.style.display = "flex";
  consultar();
}
document.getElementById("btnReporteSerenos")?.addEventListener("click", abrirReporteSerenos);
export { abrirReporteSerenos };
