////                      PROCESO PARA CREAR UN SERVICIO NUEVO            ///////
////                                                                     ///////

// === Referencias a los elementos HTML del formulario de publicación ===
const titulo = document.getElementById("titulo");
const descripcion = document.getElementById("descripcion");
const precio = document.getElementById("precio");
const categoria = document.getElementById("categoria");
const Universidad = document.getElementById("universidad");
const contacto = document.getElementById("contacto");
const modalidad_servicio = document.getElementById("modalidad-servicio");


// El identificador del usuario que está logueado en el sistema (se asume que viene de localStorage)
const publicador = localStorage.getItem("usuario");

  
  //localStorage.getItem("usuarioTelefono") ||

// Inicializar contador de servicios si no existe
if (!localStorage.getItem("servicioCounter")) {
  localStorage.setItem("servicioCounter", "0");
}

// IF de inicialización: si todavia no hay servicios en localStorage, agregamos un par de ejemplos
// para que la app no inicie vacía y se puedan ver datos de prueba.
if (!localStorage.getItem("logstore_servicios")) {
  let counter = parseInt(localStorage.getItem("servicioCounter")) || 0;
  const serviciosIniciales = [
    {
      id: "servicios" + (++counter),
      titulo: "Tutoría de Álgebra Lineal",
      descripcion: "Clases online o presencial de álgebra y matrices.",
      categoria: "tutorias",
      precio: "30000",
      universidad: "Universidad Nacional",
      contacto: "7778889944",
      modalidad: "mixta",
      icono: "📚",
      avatar: "",
      estrellas: [5, 4, 4, 5, 5],
      disponibilidad: "Entre semana",
      publicador: "Lenín",
      fechaPublicacion: new Date().toLocaleString(),
    },
    {
      id: "servicios" + (++counter),
      titulo: "Revisión de ensayo en normas APA",
      descripcion: "Corrección y estructura de ensayos universitarios.",
      categoria: "ensayos",
      precio: "25000",
      universidad: "Universidad Javeriana",
      contacto: "7778889944",
      modalidad: "presencial",
      icono: "✍️",
      avatar: "",
      estrellas: [4, 4, 5, 5],
      disponibilidad: "Siempre disponible",
      publicador: "Lenín",
      fechaPublicacion: new Date().toLocaleString(),
    },
  ];

  // Actualizar el contador en localStorage
  localStorage.setItem("servicioCounter", counter.toString());

  // Guardamos el arreglo de servicios de ejemplo en localStorage como JSON.
  localStorage.setItem(
    "logstore_servicios",
    JSON.stringify(serviciosIniciales),
  );
}

// Intentamos buscar el formulario para publicar servicios (diferentes IDs/estructura por si cambia HTML)
const formPublicar =
  document.getElementById("form-publicar-servicio") ||
  document.querySelector("#publicar")?.closest("form");

if (!formPublicar) {
  // Mensaje de error de depuración si el formulario no existe
  console.error("No se encontró el formulario de publicar servicio.");
} else {
  // Listener que procesa el submit del formulario
  formPublicar.addEventListener("submit", function (e) {
    e.preventDefault(); // evita recarga de página al enviar

    /*saca icono segun categoria*/
      let icono = "🌐"; // Icono por defecto
      switch (categoria.value) {
        case "tutorias":
          icono = "📚";
          break;
        case "ensayos":
          icono = "✍️";
          break;
        case "proyectos":
          icono = "🗂️";
          break;
        case "programacion":
          icono = "💻";
          break;
        case "diseno":
          icono = "🎨";
          break;
        case "arriendo":
          icono = "🏠";
          break;
        case "otros":
          icono = "🌐";
          break;
      }

    // Obtener y actualizar el contador
    let counter = parseInt(localStorage.getItem("servicioCounter")) || 0;
    counter++;
    localStorage.setItem("servicioCounter", counter.toString());

    // Creación del objeto con los datos ingresados
    const nuevoServicio = {
      id: "servicios" + counter,
      titulo: titulo.value.trim(),
      descripcion: descripcion.value.trim(),
      categoria: categoria.value,
      precio: precio.value,
      universidad: Universidad.value.trim(),
      contacto: contacto.value.trim(),
      modalidad: modalidad_servicio.value.trim(),
      icono: icono,
      avatar: "", //recuerda pasar este atributo despues a el perfil del usuario que publica el servicio
      estrellas: [], // Inicialmente sin calificaciones
      disponibilidad:
        document.querySelector('input[name="disponibilidad"]:checked')?.value ||
        "No especificado",
      publicador: publicador,

      fechaPublicacion: new Date().toLocaleString(),
    };

    // Leemos los servicios guardados (si existen), agregamos el nuevo y volvemos a guardar
    let serviciosGuardados = JSON.parse(localStorage.getItem("logstore_servicios")) || [];
    serviciosGuardados.push(nuevoServicio);
    localStorage.setItem("logstore_servicios",JSON.stringify(serviciosGuardados),);

    // Feedback visual / consola para saber que la acción se completó
    console.log("Servicio guardado:", nuevoServicio);
    alert("¡Servicio publicado con éxito!");

    // Limpiamos el formulario para un nuevo registro
    formPublicar.reset();
  });
}

// Función global para ver servicios cargados en consola (puede llamarse desde HTML con onclick)
window.verServicios = function () {
  const serviciosGuardados =
    JSON.parse(localStorage.getItem("logstore_servicios")) || [];
  console.clear();
  console.log("🛠️ SERVICIOS PUBLICADOS:");
  console.table(serviciosGuardados);
  console.log("Total de servicios: " + serviciosGuardados.length);
  return serviciosGuardados;
};