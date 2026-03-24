
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


/* ===== VALIDACIÓN AL ENVIAR ===== */

document.querySelector("#panel-login .btn-principal").addEventListener("click", function(e) {
  let valid = true;

  if (telefono.value.length !== 10) {
    setError(telefono, "Número inválido");
    valid = false;
  }

  if (pass.value.length < 8) {
    setError(pass, "Contraseña muy corta");
    valid = false;
  }

  if (!valid) e.preventDefault();
});