// js/firebase.js
// ============================================================
// Configuración de Firebase
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js";
import {
  getFirestore,
  collection,
  doc,
  query,
  orderBy,
  limit,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// Configuración de tu proyecto
const firebaseConfig = {
  apiKey: "AIzaSyCkNbamNjoe4HjTnu9XyiWojDFzO7KSNUA",
  authDomain: "municipalidad-msi.firebaseapp.com",
  projectId: "municipalidad-msi",
  storageBucket: "municipalidad-msi.firebasestorage.app",
  messagingSenderId: "200816039529",
  appId: "1:200816039529:web:83900cd4a0de208858b4f8",
  measurementId: "G-GDB4SNMMJL"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);


// Exportar para usar en otros archivos
export {
  app,
  analytics,
  db,
  collection,
  doc,
  query,
  orderBy,
  limit,
  onSnapshot
};
