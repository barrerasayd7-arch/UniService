
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

/* ===== VALIDACIÓN EN TIEMPO REAL - LOGIN ===== */

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

/* ===== VALIDACIÓN EN TIEMPO REAL - REGISTRAR USUARIO ===== */

const nombre = document.getElementById("r-nombre");
const telefonoReg = document.getElementById("r-telefono");
const passReg = document.getElementById("r-pass");
const passReg2 = document.getElementById("r-pass2");
const terminos = document.getElementById("terminos");

// Validar nombre (mínimo 3 caracteres)
nombre.addEventListener("input", () => {
  if (nombre.value.trim().length < 3) {
    setError(nombre, "Nombre debe tener al menos 3 caracteres");
  } else if (nombre.value.trim().length > 50) {
    setError(nombre, "Nombre muy largo");
  } else {
    setSuccess(nombre);
  }
});

// Validar teléfono de registro
telefonoReg.addEventListener("input", () => {
  const value = telefonoReg.value.replace(/\D/g, "");
  telefonoReg.value = value;

  if (value.length !== 10) {
    setError(telefonoReg, "Debe tener 10 dígitos");
  } else if (usuarios.some(u => u.telefono === value)) {
    setError(telefonoReg, "Este teléfono ya está registrado");
  } else {
    setSuccess(telefonoReg);
  }
});

// Validar contraseña de registro
passReg.addEventListener("input", () => {
  if (passReg.value.length < 8) {
    setError(passReg, "Mínimo 8 caracteres");
  } else {
    setSuccess(passReg);
    // Validar coincidencia si ya hay valor en confirmar contraseña
    if (passReg2.value.length > 0) {
      if (passReg.value !== passReg2.value) {
        setError(passReg2, "Las contraseñas no coinciden");
      } else {
        setSuccess(passReg2);
      }
    }
  }
});

// Validar confirmación de contraseña
passReg2.addEventListener("input", () => {
  if (passReg2.value.length < 8) {
    setError(passReg2, "Mínimo 8 caracteres");
  } else if (passReg.value !== passReg2.value) {
    setError(passReg2, "Las contraseñas no coinciden");
  } else {
    setSuccess(passReg2);
  }
});

/* ===== USUARIOS CON PERSISTENCIA EN LOCALSTORAGE ===== */

// Usuarios iniciales
const usuariosIniciales = [
  { telefono: "1112223344", pass: "PassTest1", nombre: "Franklin" },
  { telefono: "7778889944", pass: "PassTest2", nombre: "Lenín" },
  { telefono: "3332221144", pass: "PassTest2", nombre: "Sayd" },
  { telefono: "5556667788", pass: "PassTest3", nombre: "Andres" }
];

// Cargar usuarios del localStorage o usar los iniciales
let usuarios = JSON.parse(localStorage.getItem("usuariosRegistrados"));

if (!usuarios) {
  usuarios = usuariosIniciales;
  localStorage.setItem("usuariosRegistrados", JSON.stringify(usuarios));
}

/* ===== VALIDACIÓN AL ENVIAR - LOGIN ===== */

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

/* ===== VALIDACIÓN AL ENVIAR - REGISTRO ===== */

document.getElementById("crear_acc").addEventListener("click", function(e) {
  e.preventDefault(); // Evita envío real

  let valid = true;

  // Validar nombre
  if (nombre.value.trim().length < 3) {
    setError(nombre, "Nombre debe tener al menos 3 caracteres");
    valid = false;
  } else if (nombre.value.trim().length > 50) {
    setError(nombre, "Nombre muy largo");
    valid = false;
  }

  // Validar teléfono
  if (telefonoReg.value.length !== 10) {
    setError(telefonoReg, "Número inválido");
    valid = false;
  } else if (usuarios.some(u => u.telefono === telefonoReg.value)) {
    setError(telefonoReg, "Este teléfono ya está registrado");
    valid = false;
  }

  // Validar contraseña
  if (passReg.value.length < 8) {
    setError(passReg, "Contraseña muy corta");
    valid = false;
  }

  // Validar confirmación de contraseña
  if (passReg2.value.length < 8) {
    setError(passReg2, "Confirmar contraseña es requerido");
    valid = false;
  } else if (passReg.value !== passReg2.value) {
    setError(passReg2, "Las contraseñas no coinciden");
    valid = false;
  }

  // Validar términos
  if (!terminos.checked) {
    alert("❌ Debes aceptar los Términos y Condiciones");
    valid = false;
  }

  if (!valid) return;

  // Si todo es válido, agregar nuevo usuario al array
  const nuevoUsuario = {
    telefono: telefonoReg.value,
    pass: passReg.value,
    nombre: nombre.value.trim()
  };

  usuarios.push(nuevoUsuario);
  
  // Guardar los usuarios actualizados en localStorage
  localStorage.setItem("usuariosRegistrados", JSON.stringify(usuarios));

  // Mostrar mensaje de éxito
  alert("✅ Cuenta creada exitosamente, " + nuevoUsuario.nombre + " ✅\n\nAhora inicia sesión con tu teléfono y contraseña");

  // Limpiar formulario
  nombre.value = "";
  telefonoReg.value = "";
  passReg.value = "";
  passReg2.value = "";
  terminos.checked = false;

  // Limpiar estilos de validación
  nombre.classList.remove("error", "success");
  telefonoReg.classList.remove("error", "success");
  passReg.classList.remove("error", "success");
  passReg2.classList.remove("error", "success");

  // Redirigir a panel de login
  document.getElementById("r-login").click();
});

/* ===== FUNCIONES PARA VER USUARIOS REGISTRADOS ===== */

// Función para ver todos los usuarios en la consola
function verUsuarios() {
  console.clear();
  console.log("👥 USUARIOS REGISTRADOS:");
  console.table(usuarios);
  console.log("Total de usuarios: " + usuarios.length);
}

// Función para eliminar un usuario por teléfono
function eliminarUsuario(telefono) {
  const indice = usuarios.findIndex(u => u.telefono === telefono);
  
  if (indice === -1) {
    console.log("❌ No se encontró usuario con teléfono: " + telefono);
    return false;
  }
  
  const usuarioEliminado = usuarios[indice];
  usuarios.splice(indice, 1);
  localStorage.setItem("usuariosRegistrados", JSON.stringify(usuarios));
  
  console.log("✅ Usuario eliminado: " + usuarioEliminado.nombre + " (" + telefono + ")");
  console.log("Usuarios restantes: " + usuarios.length);
  return true;
}

// Función para eliminar todos los usuarios y volver a los iniciales
function resetearUsuarios() {
  usuarios = JSON.parse(JSON.stringify(usuariosIniciales));
  localStorage.setItem("usuariosRegistrados", JSON.stringify(usuarios));
  console.log("🔄 Base de datos reseteada. Usuarios iniciales restaurados.");
  verUsuarios();
}

// Función para buscar usuario
function buscarUsuario(telefono) {
  const usuario = usuarios.find(u => u.telefono === telefono);
  if (usuario) {
    console.log("✅ Usuario encontrado:");
    console.table([usuario]);
  } else {
    console.log("❌ No se encontró usuario con teléfono: " + telefono);
  }
  return usuario;
}

// Mostrar usuarios al cargar la página
console.log("💾 Usuarios cargados del localStorage: " + usuarios.length);
console.log(`
📋 FUNCIONES DISPONIBLES:
- verUsuarios() → Ver todos los usuarios
- eliminarUsuario("telefono") → Eliminar un usuario
- buscarUsuario("telefono") → Buscar un usuario
- resetearUsuarios() → Restaurar usuarios iniciales
`);