// js/turno.js
// ===============================
// Detecta el turno actual (TI, T2, T3-I, T3-II)
// y calcula la fecha que corresponde
// ===============================

// Detectar turno según hora
export function detectarTurno(fecha = new Date()) {
  const h = fecha.getHours();

  if (h >= 7 && h < 15) return "TI";       // 07:00 - 15:00
  if (h >= 15 && h < 23) return "T2";      // 15:00 - 23:00
  if (h >= 23) return "T3-I";              // 23:00 - 00:00
  return "T3-II";                          // 00:00 - 07:00
}

// Formatear fecha -> para <input type="date">
export function formatearFecha(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return { iso: `${yyyy}-${mm}-${dd}`, normal: `${dd}-${mm}-${yyyy}` };
}

// Función central
export function getTurnoYFecha(base = new Date()) {
  const ahora = new Date(base);
  let turno = detectarTurno(ahora);
  let fechaConsulta = new Date(ahora);

  // 🔹 Ajuste de fecha:
  // T3-II pertenece SIEMPRE al día siguiente
  if (turno === "T3-II") {
    fechaConsulta.setDate(fechaConsulta.getDate() - 1);
  }

  const { iso, normal } = formatearFecha(fechaConsulta);
  return { turno, fechaISO: iso, fechaNormal: normal };
}

// ===============================
// Extras para personal.js
// ===============================

// Convierte YYYY-MM-DD → Date
export function parseFecha(iso) {
  if (!iso) return new Date();
  const [yyyy, mm, dd] = iso.split("-");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
}

// Devuelve fecha y turno actuales
export function todayTurnDefaults() {
  const { turno, fechaISO } = getTurnoYFecha(new Date());
  return { fecha: fechaISO, turno };
}

// --- Inicialización automática en la interfaz ---
(function initTurnoUI() {
  const { turno, fechaISO } = getTurnoYFecha();

  const fechaInput = document.getElementById("fecha");
  if (fechaInput) fechaInput.value = fechaISO;

  // Activar botón de turno correspondiente
  const botones = document.querySelectorAll(".turno-buttons .mini-btn");
  botones.forEach(btn => btn.classList.remove("active"));

  if (turno === "TI") {
    document.querySelector('[data-turno="TI"]')?.classList.add("active");
  } else if (turno === "T2") {
    document.querySelector('[data-turno="T2"]')?.classList.add("active");
  } else {
    // T3-I y T3-II mapean al botón T3
    document.querySelector('[data-turno="T3"]')?.classList.add("active");
  }
})();
