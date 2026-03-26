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
      modalidad: document.querySelector('input[name="modalidad"]:checked')?.value || "No especificado",
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


function calcularEstrellas(arrayEstrellas) {
  if (!arrayEstrellas || arrayEstrellas.length === 0) return "☆☆☆☆☆ (0)";
  
  // Calcular el promedio de las estrellas
  const suma = arrayEstrellas.reduce((a, b) => a + b, 0);
  const promedio = suma / arrayEstrellas.length;
  
  // Redondeo a x.5 o x.0
  const redondeado = Math.round(promedio * 2) / 2;
   
  const fullStars = Math.floor(redondeado);
  // Verificar si hay media estrella
  const hasHalf = redondeado % 1 !== 0;

  let estrellasHtml = "";
  for (let i = 1; i <= 5; i++) {
    if (i <= fullStars) {
      estrellasHtml += "★";
    } else if (hasHalf && i === fullStars + 1) {
      estrellasHtml += "⯨"; // Media estrella (icono)
    } else {
      estrellasHtml += "☆";
    }
  }

  return `${estrellasHtml} (${promedio.toFixed(1)})`;
}



/**
 * Calcula el promedio de un array de estrellas y devuelve el HTML de estrellas
 */
function obtenerEstrellasHTML(estrellasArray) {
    if (!estrellasArray || estrellasArray.length === 0) return { html: "☆☆☆☆☆", promedio: "0.0" };
    
    const suma = estrellasArray.reduce((a, b) => a + b, 0);
    const promedio = suma / estrellasArray.length;
    const redondeado = Math.round(promedio * 2) / 2;
    
    let html = "";
    for (let i = 1; i <= 5; i++) {
        if (i <= redondeado) html += "★";
        else if (i - 0.5 === redondeado) html += "⯨";
        else html += "☆";
    }
    return { html, promedio: promedio.toFixed(1) };
}

/**
 * Filtra, ordena y renderiza el Top 3 de servicios
 */
function renderTop3() {
    const contenedor = document.getElementById("contenedor-top-3");
    const servicios = JSON.parse(localStorage.getItem("logstore_servicios")) || [];

    if (!contenedor) return;

    // 1. Procesar y Ordenar: De mayor promedio a menor
    const top3 = servicios
        .map(s => {
            const info = obtenerEstrellasHTML(s.estrellas);
            return { ...s, promedioNum: parseFloat(info.promedio), estrellasVisual: info.html };
        })
        .sort((a, b) => b.promedioNum - a.promedioNum) // Orden descendente
        .slice(0, 3); // Solo los mejores 3

    // 2. Generar el HTML
    contenedor.innerHTML = top3.map((servicio, index) => `
        <a href="Servicio.html?id=${servicio.id}" class="card-servicio card-top">
            <div class="card-body-custom">
                <div class="card-top-header">
                    <div>
                        <p class="badge-top">#${index + 1} MEJOR CALIFICADO</p>
                        <h5>${servicio.titulo}</h5>
                        <p class="texto-muted">${servicio.universidad}</p>
                    </div>
                    <div class="card-emoji">${servicio.icono || "⭐"}</div>
                </div>
                <div class="estrellas" style="color: #ffc107; font-size: 1.2rem;">
                    ${servicio.estrellasVisual}
                </div>
                <div class="texto-muted">${servicio.promedioNum} (${servicio.estrellas?.length || 0} reseñas)

                </div>
                <div class="card-footer card-footer-top">
                    <div class="card-autor">
                        <div class="avatar avatar-amarillo avatar-sm">
                            ${servicio.avatar || servicio.publicador.charAt(0).toUpperCase()}
                        </div>
                        <span class="texto-muted">${servicio.publicador}</span>
                    </div>
                    <div class="precio">${Number(servicio.precio).toLocaleString()}$</div>
                </div>
                 <p class="texto-muted">${servicio.descripcion}</p>
            </div>
        </a>
    `).join('');
}

// Ejecutar cuando la página esté lista
window.addEventListener("DOMContentLoaded", renderTop3);



/**
 * Renderiza exclusivamente los servicios del usuario logueado
 */
function renderMisServicios() {
    const contenedor = document.getElementById("contenedor-mis-servicios");
    const todosLosServicios = JSON.parse(localStorage.getItem("logstore_servicios")) || [];
    const usuarioActual = localStorage.getItem("usuario"); // El usuario logueado

    if (!contenedor) return;

    // 1. Filtramos por dueño
    const misServicios = todosLosServicios.filter(s => s.publicador === usuarioActual);

    // Si no tiene nada publicado
    if (misServicios.length === 0) {
        contenedor.innerHTML = `
            <div class="text-center p-5 border rounded" style="border-style: dashed !important;">
                <p class="texto-gris">Aún no has publicado ningún servicio.</p>
                <a href="#publicar servicio" class="btn btn-sm boton-principal">¡Publicar mi primer servicio!</a>
            </div>`;
        return;
    }

    // 2. Generamos el HTML (usando tu estructura de "fila-pedido")
    contenedor.innerHTML = misServicios.reverse().map(servicio => {
        const infoEstrellas = obtenerEstrellasHTML(servicio.estrellas);
        
        return `
            <div class="fila-pedido">
                <div class="row align-items-center g-2">
                    <div class="col-auto" style="font-size:1.8rem;">${servicio.icono || "🌐"}</div>
                    <div class="col">
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <strong>${servicio.titulo}</strong>
                            <span class="insignia et-verde">Activo</span>
                        </div>
                        <div class="texto-gris">
                            Publicado el ${servicio.fechaPublicacion} · ${servicio.modalidad}
                        </div>
                    </div>
                    <div class="col-auto text-end">
                        <div class="calificacion-estrellas" style="color: #ffc107;">${infoEstrellas.html}</div>
                        <div class="texto-gris">${infoEstrellas.promedio} (${servicio.estrellas?.length || 0})</div>
                    </div>
                    <div class="col-auto d-flex gap-2">
                        <button class="btn boton-secundario btn-sm" onclick="editarServicio('${servicio.id}')">✏️ Editar</button>
                        <button class="btn boton-peligro btn-sm" onclick="pausarServicio('${servicio.id}')">⏸ Pausar</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Asegúrate de llamarla cuando cargue el DOM
window.addEventListener("DOMContentLoaded", () => {
    renderTop3();
    renderMisServicios();
});