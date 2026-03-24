
/* ===== FUNCIONES ===== */

function setError(input, message) {
  input.classList.add("error");
  input.classList.remove("success");
  input.nextElementSibling.textContent = message;
}

function setSuccess(input) {
  input.classList.remove("error");
  input.classList.add("success");
  input.nextElementSibling.textContent = "";
}
console.log("JS conectado correctamente");

/* ===== VALIDACIÓN EN TIEMPO REAL ===== */

const telefono = document.getElementById("l-telefono");
const pass = document.getElementById("l-pass");

telefono.addEventListener("input", () => {
  const value = telefono.value.replace(/\D/g, "");
  telefono.value = value;

  if (value.length !== 10) {
    setError(telefono, "Debe tener 10 dígitos");
  } else {
    setSuccess(telefono);
  }
});

pass.addEventListener("input", () => {
  if (pass.value.length < 8) {
    setError(pass, "Mínimo 8 caracteres");
  } else {
    setSuccess(pass);
  }
});

// Usuarios temporales para pruebas de login (en un proyecto real esto se haría con una base de datos y autenticación segura)
const usuarios = [
  { telefono: "1112223344", pass: "PassTest1", nombre: "Franklin" },
  { telefono: "7778889944", pass: "PassTest2", nombre: "Lenín" },
  { telefono: "3332221144", pass: "PassTest2", nombre: "Sayd" },
  { telefono: "5556667788", pass: "PassTest3", nombre: "Andres" }
];

/* ===== VALIDACIÓN AL ENVIAR ===== */

document.querySelector("#panel-login .btn-principal").addEventListener("click", function(e) {
  e.preventDefault(); // Evita envío real

  let valid = true;

  if (telefono.value.length !== 10) {
    setError(telefono, "Número inválido");
    valid = false;
  }

  if (pass.value.length < 8) {
    setError(pass, "Contraseña muy corta");
    valid = false;
  }

  if (!valid) return;

  // Validar contra usuarios temporales
  const usuario = usuarios.find(u => u.telefono === telefono.value && u.pass === pass.value);

  if (usuario) {
    alert("✅ Bienvenido " + usuario.nombre + " ✅");
    window.location.href = "HomePrincipal.html"; // Redirige a página de usuario
    localStorage.setItem("logueado", "true");             // Marca como logueado
    localStorage.setItem("usuario", usuario.nombre);      // Guarda nombre para mostrar en Home
  } else {
    alert("❌ Teléfono o contraseña incorrectos ❌");
  }
});