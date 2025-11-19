// js/mapa.js
// ============================================================
// Núcleo del mapa (Leaflet) + Geocercas + Leyendas
// ============================================================

import { db } from "./firebase.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// Crear mapa centrado en San Isidro
export const map = L.map("map").setView([-12.097, -77.037], 14);

// Capa base OSM
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://osm.org/copyright">OSM</a>'
}).addTo(map);

// Capas lógicas
export const capaGeofences = L.layerGroup().addTo(map); // polígonos
export const capaSerenos   = L.layerGroup().addTo(map); // personal
export const capaLocales = L.layerGroup().addTo(map);


/* ============================================================
   Helpers
   ============================================================ */
export function iconSereno(color = "blue") {
  return L.icon({
    iconUrl: color === "red" ? "../icon2.png" : "../icon1.png",
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -22]

  });
}



export function getCoords(data) {
  if (!data) return null;
  if (typeof data.lat === "number" && typeof data.lng === "number") {
    return [data.lat, data.lng];
  }
  return null;
}

export function getWhenS(data) {
  if (!data?.timestamp) return null;
  if (typeof data.timestamp.toDate === "function") return data.timestamp.toDate();
  return new Date(data.timestamp);
}

// Para pintar azul/rojo según antigüedad
export function colorByAge(ts) {
  if (!ts) return "blue";
  const ms = (ts instanceof Date) ? ts.getTime() : Number(ts);
  const diffH = (Date.now() - ms) / 3_600_000;
  return diffH >= 2 ? "red" : "blue";
}

/* ============================================================
   Detección de sector por geocerca
   ============================================================ */

// Cache de geocercas
let geofencesData = [];

// Verifica si un punto está dentro de un polígono (ray casting)
function pointInPolygon(point, vs) {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
                      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Devuelve el sector correspondiente a un punto
export function getSectorForPoint(lat, lng) {
  for (const gf of geofencesData) {
    if (pointInPolygon([lat, lng], gf.coords)) {
      return gf.sector; // ej: "Sector 02"
    }
  }
  return null; // fuera de todas las geocercas
}

/* ============================================================
   Leyendas dinámicas
   ============================================================ */

// Actualiza los contadores de la leyenda manual
export function updateSectorCountsFrom(mapSerenos) {
  // Reiniciar todos los contadores a 0
  document.querySelectorAll(".sector-legend .val").forEach(el => {
    el.textContent = "0";
  });

  // Recorrer serenos activos
  for (const { data } of mapSerenos.values()) {
    if (data?.sector) {
      // Extraer número del nombre: "Sector 02" → "2"
      const matchNum = String(data.sector).match(/\d+/)?.[0];
      if (!matchNum) continue;

      const el = document.getElementById(`s${parseInt(matchNum, 10)}`);
      if (el) {
        const cur = parseInt(el.textContent || "0", 10);
        el.textContent = cur + 1;
      }
    }
  }
}

/* ============================================================
   Geocercas
   ============================================================ */
onSnapshot(collection(db, "geofences"), (snapshot) => {
  capaGeofences.clearLayers();
  geofencesData = []; // reset cache

  snapshot.forEach((doc) => {
    const data = doc.data();

    if (data.geometry?.path && data.geometry.path.length > 2) {
      const coords = data.geometry.path.map(p => [p.lat, p.lng]);

      // 🔹 Guardar en memoria para detección de sector
      geofencesData.push({
        sector: data.nombre, // usamos "nombre" (ej: "Sector 02")
        coords
      });

      const polygon = L.polygon(coords, {
        color: data.color || "blue",
        weight: 2,
        fillColor: data.color || "blue",
        fillOpacity: 0.25
      }).addTo(capaGeofences);

      if (data.nombre) {
        polygon.bindPopup(`<b>${data.nombre}</b>`);
      }
    }
  });
});
