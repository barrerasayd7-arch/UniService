/* ===== FUNCIONES ===== */

function setError(input, message) {
  input.classList.add("error");
  input.classList.remove("success");
  const span = input.nextElementSibling || input.closest(".campo").querySelector(".error-msg");
  if (span) span.textContent = message;
}

function setSuccess(input) {
  input.classList.remove("error");
  input.classList.add("success");
  const span = input.nextElementSibling || input.closest(".campo").querySelector(".error-msg");
  if (span) span.textContent = "";
}

/* ===== ELEMENTOS ===== */

const telefono    = document.getElementById("l-telefono");
const pass        = document.getElementById("l-pass");
const nombre      = document.getElementById("r-nombre");
const telefonoReg = document.getElementById("r-telefono");
const passReg     = document.getElementById("r-pass");
const passReg2    = document.getElementById("r-pass2");
const terminos    = document.getElementById("terminos");

/* ===== VALIDACIÓN EN TIEMPO REAL - LOGIN ===== */

telefono.addEventListener("input", () => {
  const value = telefono.value.replace(/\D/g, "");
  telefono.value = value;
  value.length !== 10 ? setError(telefono, "Debe tener 10 dígitos") : setSuccess(telefono);
});

pass.addEventListener("input", () => {
  pass.value.length < 8 ? setError(pass, "Mínimo 8 caracteres") : setSuccess(pass);
});

/* ===== VALIDACIÓN EN TIEMPO REAL - REGISTRO ===== */

nombre.addEventListener("input", () => {
  const len = nombre.value.trim().length;
  if (len < 3) setError(nombre, "Mínimo 3 caracteres");
  else if (len > 50) setError(nombre, "Nombre muy largo");
  else setSuccess(nombre);
});

telefonoReg.addEventListener("input", () => {
  const value = telefonoReg.value.replace(/\D/g, "");
  telefonoReg.value = value;
  value.length !== 10 ? setError(telefonoReg, "Debe tener 10 dígitos") : setSuccess(telefonoReg);
});

passReg.addEventListener("input", () => {
  if (passReg.value.length < 8) {
    setError(passReg, "Mínimo 8 caracteres");
  } else {
    setSuccess(passReg);
    if (passReg2.value.length > 0) {
      passReg.value !== passReg2.value
        ? setError(passReg2, "Las contraseñas no coinciden")
        : setSuccess(passReg2);
    }
  }
});

passReg2.addEventListener("input", () => {
  if (passReg2.value.length < 8) setError(passReg2, "Mínimo 8 caracteres");
  else if (passReg.value !== passReg2.value) setError(passReg2, "Las contraseñas no coinciden");
  else setSuccess(passReg2);
});

/* ===== LOGIN ===== */

document.querySelector("#panel-login .btn-principal").addEventListener("click", function(e) {
  e.preventDefault();

  let valid = true;
  if (telefono.value.length !== 10) { setError(telefono, "Número inválido"); valid = false; }
  if (pass.value.length < 8)        { setError(pass, "Contraseña muy corta"); valid = false; }
  if (!valid) return;

  fetch(`http://localhost/api/crud/usuario_crud.php?telefono=${telefono.value}&password=${pass.value}`)
  .then(res => res.json())
  .then(data => {
    if (data.ok) {
      localStorage.setItem("logueado", "true");
      localStorage.setItem("usuarioId", data.id);
      localStorage.setItem("usuario", data.nombre);
      localStorage.setItem("usuarioTelefono", data.telefono);

      // Marcar como activo en la base
      fetch("http://localhost/api/crud/usuario_crud.php", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_usuario: data.id, estado: 1 })
      }).finally(() => {
        alert("✅ Bienvenido " + data.nombre + " ✅");
        window.location.href = "HomePrincipal.html";
      });

    } else {
      alert("❌ Teléfono o contraseña incorrectos ❌");
    }
  })
  .catch(() => alert("❌ Error de conexión con el servidor"));
});

const botonInvitado = document.getElementById("btn-invitado");
if (botonInvitado) {
  botonInvitado.addEventListener("click", () => {
    localStorage.removeItem("logueado");
    localStorage.removeItem("usuario");
    localStorage.removeItem("usuarioTelefono");
    window.location.href = "HomeGuest.html";
  });
}

  }

  if (!terminos.checked) { alert("❌ Debes aceptar los Términos y Condiciones"); valid = false; }

  if (!valid) return;

  const nuevoUsuario = {
    telefono: telefonoReg.value,
    password: passReg.value,
    nombre:   nombre.value.trim()
  };

  fetch("http://localhost/api/crud/usuario_crud.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(nuevoUsuario)
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      alert("❌ " + data.error);
    } else {
      alert("✅ Cuenta creada exitosamente, " + nuevoUsuario.nombre + " ✅\n\nAhora inicia sesión.");
      nombre.value = ""; telefonoReg.value = ""; passReg.value = ""; passReg2.value = "";
      terminos.checked = false;
      [nombre, telefonoReg, passReg, passReg2].forEach(i => i.classList.remove("error", "success"));
      document.getElementById("r-login").click();
    }
  })
  .catch(() => alert("❌ Error de conexión con el servidor"));
});

/* ===== EFECTO DINÁMICO DE FONDO EN SCROLL ===== */

document.addEventListener('DOMContentLoaded', function() {
  const dynamicBg = document.querySelector('.dynamic-bg');
  if (dynamicBg) {
    window.addEventListener('scroll', function() {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollProgress = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;
      dynamicBg.style.opacity   = Math.max(0.3, 1 - scrollProgress * 0.5);
      dynamicBg.style.transform = `scale(${1 + scrollProgress * 0.1})`;
      dynamicBg.style.filter    = `blur(${scrollProgress * 10}px)`;
    });
  }
});