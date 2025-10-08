// js/login.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// 🔹 Configuración del mismo proyecto municipalidad-msi
const firebaseConfig = {
  apiKey: "AIzaSyCkNbamNjoe4HjTnu9XyiWojDFzO7KSNUA",
  authDomain: "municipalidad-msi.firebaseapp.com",
  projectId: "municipalidad-msi",
  storageBucket: "municipalidad-msi.firebasestorage.app",
  messagingSenderId: "200816039529",
  appId: "1:200816039529:web:83900cd4a0de208858b4f8",
  measurementId: "G-GDB4SNMMJL"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// === ELEMENTOS DEL DOM ===
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");
const errorMsg = document.getElementById("errorMsg");

btnLogin.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  errorMsg.textContent = "";

  if (!email || !password) {
    errorMsg.textContent = "Por favor ingrese su correo y contraseña.";
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    console.log("✅ Sesión iniciada:", user.email);

    // Guardar sesión local
    localStorage.setItem("msiUser", JSON.stringify({
      email: user.email,
      uid: user.uid,
    }));

    // Redirigir al panel principal
    window.location.href = "index.html";
  } catch (error) {
    console.error("❌ Error al iniciar sesión:", error.code, error.message);
    switch (error.code) {
      case "auth/invalid-email":
        errorMsg.textContent = "Correo inválido.";
        break;
      case "auth/invalid-credential":
      case "auth/wrong-password":
        errorMsg.textContent = "Correo o contraseña incorrectos.";
        break;
      case "auth/user-not-found":
        errorMsg.textContent = "El usuario no existe.";
        break;
      default:
        errorMsg.textContent = "Error al iniciar sesión.";
    }
  }
});
