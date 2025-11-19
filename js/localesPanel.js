// localesPanel.js
import { map, capaSerenos } from "./mapa.js";
import { LOCALES } from "./locales.js";
import { setViendoLocales } from "./personal.js";

import { db } from "./firebase.js";
import {
  collectionGroup,
  query,
  where,
  orderBy,
  onSnapshot,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getTurnoYFecha } from "./turno.js";

export const capaLocales = L.layerGroup().addTo(map);

// dni-> { data }
const latestByLocal = new Map();

/* =============== Helpers =============== */
function toMillis(ts) {
  return ts?.toMillis ? ts.toMillis() : Number(ts || 0);
}

function distanciaMetros(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const x = dLng * Math.cos((lat1 + lat2) / 2);
  const y = dLat;
  return Math.sqrt(x * x + y * y) * R;
}

function estadoLocal(data, local) {
  if (!data?.timestamp || data.lat == null || data.lng == null) {
    console.warn(`❌ [${local.id}] No hay datos válidos`, data);
    return "red";
  }
  const ms = toMillis(data.timestamp);
  const diffH = (Date.now() - ms) / 3_600_000;
  const dist = distanciaMetros(
    { lat: local.lat, lng: local.lng },
    { lat: data.lat, lng: data.lng }
  );
  const ok = diffH <= 2 && dist <= 200;

  console.log(`📍 Local ${local.label} (${local.id})
   - Fecha/Hora registro: ${data.fecha} ${data.hora}
   - Timestamp: ${new Date(ms).toLocaleString("es-PE")}
   - Δ horas: ${diffH.toFixed(2)}
   - Distancia: ${dist.toFixed(2)} m
   - Dentro 200 m: ${dist <= 200}
   - Estado: ${ok ? "blue" : "red"}`);

  return ok ? "blue" : "red";
}

function iconLocal(color = "blue") {
  return L.icon({
    iconUrl: color === "red" ? "../casa2.png" : "../casa1.png",
    iconSize: [28, 28],     // tamaño recomendado
    iconAnchor: [14, 28],   // punto inferior
    popupAnchor: [0, -28]
  });
}


/* =============== Render UI =============== */
function renderLocalesUI(filtro = "TODO", texto = "") {
  capaLocales.clearLayers();
  const lista = document.getElementById("listaLocales");
  if (!lista) return;
  lista.innerHTML = "";
  let count = 0;

  for (const [id, local] of Object.entries(LOCALES)) {
    const entry = latestByLocal.get(id);
    const data = entry?.data;
    const estado = estadoLocal(data, local);

    const matchFiltro =
      filtro === "TODO" ||
      (filtro === "PATRULLADOS" && estado === "blue") ||
      (filtro === "NOPATRULLADOS" && estado === "red");

    const matchTexto =
      !texto ||
      local.label.toLowerCase().includes(texto) ||
      local.direccion.toLowerCase().includes(texto);

    if (matchFiltro && matchTexto) {
      count++;

      const marker = entry?.marker || L.marker([local.lat, local.lng]);
      marker.setIcon(iconLocal(estado));
      marker.bindPopup(`
        <b>${local.label}</b><br>
        ${local.direccion}<br>
        Estado: ${estado === "blue" ? "Patrullado" : "No patrullado"}
      `);
      capaLocales.addLayer(marker);

      const div = document.createElement("div");
      div.className = "local-item";
      div.textContent = local.label;
      div.addEventListener("click", () => {
        map.setView([local.lat, local.lng], 18);
        marker.openPopup();
      });
      lista.appendChild(div);
    }
  }

  const chip = document.querySelector(".count-locales");
  if (chip) chip.textContent = String(count);
}

/* =============== Suscripción =============== */
function suscribirLocales() {
  // Usamos el mismo helper que personal.js
  const { fechaNormal, turno } = getTurnoYFecha();

  // IMPORTANTE: en "locales" el campo fecha viene con SLASHES (DD/MM/YYYY)
  const fechaConSlash = fechaNormal.replace(/-/g, "/");

  console.log(`🟢 Suscribiendo LOCALES → FechaCampo: ${fechaConSlash}, TurnoCampo: ${turno}`);

  // Armar consulta a la collectionGroup "registros" filtrando por fecha y turno del CAMPO
  // T3 requiere dos valores
  let qBase;
  if (turno === "T3") {
    qBase = query(
      collectionGroup(db, "registros"),
      where("fecha", "==", fechaConSlash),
      where("turno", "in", ["T3-I", "T3-II"]),
      orderBy("timestamp", "desc"),
      limit(1000)
    );
  } else {
    qBase = query(
      collectionGroup(db, "registros"),
      where("fecha", "==", fechaConSlash),
      where("turno", "==", turno),
      orderBy("timestamp", "desc"),
      limit(1000)
    );
  }

  onSnapshot(qBase, (snap) => {
    latestByLocal.clear();

    if (snap.empty) {
      console.warn("⚠️ No llegaron registros para esa fecha/turno (revisa formato de fecha y turno).");
    }

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const idLocal = data?.idLocal;
      if (!idLocal) return;

      const prev = latestByLocal.get(idLocal);
      if (!prev || toMillis(data.timestamp) > toMillis(prev.data.timestamp)) {
        latestByLocal.set(idLocal, { data });
      }
    });

    aplicarFiltrosLocales();
  });
}

function aplicarFiltrosLocales() {
  const filtro =
    document.getElementById("filtroEstadoLocales")?.value || "TODO";
  const texto =
    document.getElementById("buscarLocal")?.value.toLowerCase().trim();
  renderLocalesUI(filtro, texto);
}
/* =============== Export: lista de locales en rojo =============== */
export function getLocalesRojos() {
  let rojos = [];
  for (const [id, local] of Object.entries(LOCALES)) {
    const entry = latestByLocal.get(id);
    const data = entry?.data;
    if (estadoLocal(data, local) === "red") {
      rojos.push(local.label); // guardamos el nombre
    }
  }
  return rojos;
}
window.addEventListener("showPersonal", () => {
  setViendoLocales(false);   // ← dejar de bloquear markers de serenos
  capaLocales.clearLayers(); // ← limpiar casas del mapa

  const btnActivo = document.querySelector(".turno-buttons .mini-btn.active");
  if (btnActivo) btnActivo.click();  // refrescar personal
});

/* =============== Init =============== */
(function initUI() {
  document
    .getElementById("filtroEstadoLocales")
    ?.addEventListener("change", aplicarFiltrosLocales);
  document
    .getElementById("buscarLocal")
    ?.addEventListener("input", aplicarFiltrosLocales);

  window.addEventListener("showLocales", () => {
  setViendoLocales(true);       // ← ACTIVAR BLOQUEO
  capaSerenos.clearLayers();    // ocultar serenos en modo locales
  suscribirLocales();
});

  


 
})();
