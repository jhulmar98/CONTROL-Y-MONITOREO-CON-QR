// ============================================================
// 🔥 Notificaciones: solo lectura (estilo WhatsApp)
// ============================================================
import { db } from "./firebase.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const COL_NAME = "notificacion";
const PANEL_ID = "panel-notificaciones";
const FEED_ID  = "notiFeed";

// Utilidades de scroll
function isVisible(el) {
  if (!el) return false;
  return getComputedStyle(el).display !== "none";
}
function isAtBottom(el, tolerance = 4) {
  // ¿Está el usuario pegado al final?
  return el.scrollHeight - (el.scrollTop + el.clientHeight) <= tolerance;
}
function scrollToBottom(el) {
  // Usamos rAF para asegurar que el layout ya está aplicado
  requestAnimationFrame(() => {
    el.scrollTop = el.scrollHeight;
  });
}

// Observa la visibilidad del panel y, cuando se muestre, baja el feed
function observarPanelParaScroll() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;

  const aplicar = () => {
    const feed = document.getElementById(FEED_ID);
    if (feed && isVisible(panel)) scrollToBottom(feed);
  };

  // Al abrir con display:flex/none (cambio de style)
  const obs = new MutationObserver(aplicar);
  obs.observe(panel, { attributes: true, attributeFilter: ["style", "class"] });

  // También por si el panel ya estaba visible al cargar
  aplicar();
}

// ============================================================
// FEED tipo chat flotante (solo visualización)
// ============================================================
function iniciarFeedSoloLectura() {
  const cont = document.getElementById(FEED_ID);
  if (!cont) return;

  // 🔹 Orden ascendente (mensajes más antiguos primero)
  const q = query(collection(db, COL_NAME), orderBy("timestamp", "asc"));

  onSnapshot(q, (snap) => {
    // ¿Debemos mantener pegado al final? (si ya estaba abajo o el panel está oculto)
    const panel = document.getElementById(PANEL_ID);
    const stickToEnd = !panel || !isVisible(panel) || isAtBottom(cont);

    cont.innerHTML = "";

    if (snap.empty) {
      cont.innerHTML = "<p style='color:gray;font-size:0.9rem;'>No hay notificaciones</p>";
      if (stickToEnd) scrollToBottom(cont);
      return;
    }

    // 🔹 Recorrer mensajes y mostrarlos en orden ascendente
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const fecha = d?.timestamp?.toDate
        ? d.timestamp.toDate().toLocaleString("es-PE", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
          })
        : "";

      const div = document.createElement("div");
      div.className = "noti-item";
      // 🔹 Estilo distinto si es mensaje del sistema o manual
      div.classList.add(d?.tipo === "personalizado" ? "user" : "system");

      div.innerHTML = `
        <div>${d?.mensaje ?? ""}</div>
        <small>${fecha}${d?.sector && d.sector !== "Todos" ? " • " + d.sector : ""}</small>
      `;

      cont.appendChild(div);
    });

    // 🔹 Auto-scroll hacia el final (nuevo mensaje abajo) solo si corresponde
    if (stickToEnd) scrollToBottom(cont);
  });
}

// ============================================================
// INIT principal
// ============================================================
export function initNotificacionesUI() {
  iniciarFeedSoloLectura();
  observarPanelParaScroll(); // asegura que al abrir el panel quede al final
}
