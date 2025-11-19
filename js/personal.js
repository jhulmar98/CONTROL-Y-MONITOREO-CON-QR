/* js/personal.js
   =====================================================================
   PERSONAL en el mapa (asistencias)
   Estructura:
   asistencias/{DD-MM-YYYY}/{turno}/{dni}/registros/{doc}
   ===================================================================== */

import { db } from "./firebase.js";
import {
  collectionGroup, query, where, orderBy, onSnapshot, limit
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { capaSerenos, updateSectorCountsFrom, getSectorForPoint } from "./mapa.js";
import { getTurnoYFecha } from "./turno.js";

/* =====================================================================
   Helpers de fecha
   ===================================================================== */
function normDMY(input) {
  if (!input) return null;
  const s = String(input).trim();
  let dd, mm, yyyy;
  if (s.includes("-")) {
    const p = s.split("-");
    if (p[0].length === 4) [yyyy, mm, dd] = p; else [dd, mm, yyyy] = p;
  } else if (s.includes("/")) {
    const p = s.split("/");
    if (p[0].length === 4) [yyyy, mm, dd] = p; else [dd, mm, yyyy] = p;
  } else return null;
  return `${String(dd).padStart(2,"0")}-${String(mm).padStart(2,"0")}-${yyyy}`;
}
function dmyToDate(dmy) {
  const [dd, mm, yyyy] = dmy.split("-");
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
}
function dmyToNext(dmy) {
  const d = dmyToDate(dmy); d.setDate(d.getDate() + 1);
  return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
}

/* =====================================================================
   Helpers varios
   ===================================================================== */
const toMillis = (ts) =>
  (ts && typeof ts.toMillis === "function") ? ts.toMillis() : Number(ts || 0);

const colorByAge = (ms) =>
  ((Date.now() - ms) / 3_600_000) >= 2 ? "red" : "blue";

function iconSereno(color = "blue") {
  return L.icon({
    iconUrl: color === "red" ? "../icon2.png" : "../icon1.png",
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -22]

  });
}



function bindPopup(marker, data) {
  marker.bindPopup(`
    <div>
      <b>${data.nombre || "-"}</b><br>
      DNI: ${data.dni || "-"}<br>
      Cargo: ${data.cargo || "-"}<br>
      Supervisor: ${data.supervisor_nombre || "-"}<br>
      Turno: ${data.turno.startsWith("T3") ? "T3" : data.turno}<br>
      Fecha: ${data.fecha || "-"}<br>
      Hora: ${data.hora || "-"}<br>
      Comentario: ${data.comentario || "—"}<br>
      Lugar: ${data.sector || "—"}<br>
      Lat: ${data.lat}, Lng: ${data.lng}
    </div>
  `);
}
// Controla si estamos viendo el panel de locales
let viendoLocales = false;
export function setViendoLocales(flag) {
  viendoLocales = flag;
}


/* =====================================================================
   Estado
   ===================================================================== */
const latestByDni = new Map(); // dni -> { marker, ts, data }
export function getConteoPersonal() {
  return latestByDni.size;
}
let unsubs = [];


/* =====================================================================
   Suscripción
   ===================================================================== */
function suscribirRuta(fecha, turno, { acumulando = false } = {}) {
  const q = query(
    collectionGroup(db, "registros"),
    where("fecha", "==", fecha),
    where("turno", "==", turno),
    orderBy("timestamp", "desc"),
    limit(800)
  );

  const unsub = onSnapshot(q, (snap) => {
    if (!acumulando) {
      latestByDni.clear();
      capaSerenos.clearLayers();
    }

    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      if (data.lat == null || data.lng == null) return;

      const dni = String(data.dni || docSnap.id);
      const ts = toMillis(data.timestamp);
      const prev = latestByDni.get(dni);

      

        // ⚠️ Actualizamos data, pero NO dibujamos si estamos en LOCALES
        if (!prev || ts > prev.ts) {
          const col = colorByAge(ts);

          // Solo dibujar si NO estamos viendo locales
          if (!viendoLocales) {
            const marker = prev?.marker || L.marker([data.lat, data.lng]);
            marker.setLatLng([data.lat, data.lng]).setIcon(iconSereno(col));
            bindPopup(marker, data);
            latestByDni.set(dni, { marker, ts, data });
          } else {
            // Guardar los datos pero sin dibujar marker
            latestByDni.set(dni, { marker: prev?.marker, ts, data });
          }
        }

    });

    if (!viendoLocales) aplicarFiltrosUI();

  });

  unsubs.push(unsub);
}

/* =====================================================================
   Orquestador
   ===================================================================== */
function suscribirPersonal(fechaDmy, turno) {
  unsubs.forEach(u => { try { u(); } catch {} });
  unsubs = [];
  latestByDni.clear();
  capaSerenos.clearLayers();

  if (turno === "T3") {
    suscribirRuta(fechaDmy, "T3-I", { acumulando: true });
    suscribirRuta(dmyToNext(fechaDmy), "T3-II", { acumulando: true });
  } else if (turno === "TODO") {
    suscribirRuta(fechaDmy, "TI", { acumulando: true });
    suscribirRuta(fechaDmy, "T2", { acumulando: true });
    suscribirRuta(fechaDmy, "T3-I", { acumulando: true });
    suscribirRuta(dmyToNext(fechaDmy), "T3-II", { acumulando: true });
  } else {
    suscribirRuta(fechaDmy, turno, { acumulando: false });
  }
}

/* =====================================================================
   Filtros de UI
   ===================================================================== */
function aplicarFiltrosUI() {
  capaSerenos.clearLayers();

  const texto = (document.querySelector("input[placeholder='Nombre o Código']")?.value || "").toLowerCase().trim();
  const soloComentario = document.querySelector(".check input")?.checked;

  let filtered = new Map();
  let count = 0;

  for (const [dni, { marker, data }] of latestByDni.entries()) {
    const matchTexto =
      !texto ||
      (String(data.dni || "").includes(texto)) ||
      (String(data.nombre || "").toLowerCase().includes(texto));

    const matchComentario =
      !soloComentario || (data.comentario && data.comentario.trim() !== "");

    if (matchTexto && matchComentario) {
      capaSerenos.addLayer(marker);
      filtered.set(dni, { data });
      count++;
    }
  }

  // 🔹 Actualizar contador global
  const chip = document.querySelector(".count");
  if (chip) chip.textContent = String(count);

  // 🔹 Actualizar la leyenda por sector
  updateSectorCountsFrom(filtered);
}

/* =====================================================================
   Inicialización UI
   ===================================================================== */
(function initUI() {
  const { fechaNormal, turno } = getTurnoYFecha();

  const fechaInput = document.getElementById("fecha");
  if (fechaInput) {
    if (!fechaInput.value) {
      const [dd, mm, yyyy] = fechaNormal.split("-");
      fechaInput.value = `${yyyy}-${mm}-${dd}`;
    }
    fechaInput.addEventListener("change", () => {
      const fechaDmy = normDMY(fechaInput.value);
      if (!fechaDmy) return;
      const turnoActivo =
        document.querySelector(".turno-buttons .mini-btn.active")?.dataset.turno || "TI";
      suscribirPersonal(fechaDmy, turnoActivo);
    });
  }

  document.querySelectorAll(".turno-buttons .mini-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".turno-buttons .mini-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const fechaDmy = normDMY(document.getElementById("fecha").value);
      if (!fechaDmy) return;
      suscribirPersonal(fechaDmy, btn.dataset.turno);
    });
  });

  document.querySelector("input[placeholder='Nombre o Código']")
    ?.addEventListener("input", aplicarFiltrosUI);
  document.querySelector(".check input")
    ?.addEventListener("change", aplicarFiltrosUI);

  // Botón "Hoy"
  document.querySelector(".btn.full")?.addEventListener("click", () => {
    const { fechaNormal, turno } = getTurnoYFecha();
    const [dd, mm, yyyy] = fechaNormal.split("-");
    fechaInput.value = `${yyyy}-${mm}-${dd}`;
    document.querySelectorAll(".turno-buttons .mini-btn").forEach(b => b.classList.remove("active"));
    document.querySelector(`[data-turno="${turno}"]`)?.classList.add("active");
    suscribirPersonal(fechaNormal, turno);
  });

  // Primera carga
  suscribirPersonal(fechaNormal, turno);
})();
/* =====================================================================
   Export extra: conteo de serenos en rojo por sector
   ===================================================================== */
  export function getSerenosPorSector() {
    // Inicializa 5 sectores en 0
    const sectores = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };

    for (const { data, ts } of latestByDni.values()) {
      if (data?.sector) {
        // Extraer el número de sector desde "Sector 02"
        const match = String(data.sector).match(/\d+/)?.[0];
        if (match) {
          // ¿lleva más de 2h sin escaneo?
          const diffH = (Date.now() - ts) / 3_600_000;
          if (diffH >= 2) {
            sectores[match] = (sectores[match] || 0) + 1;
          }
        }
      }
    }

    return sectores;
  }
