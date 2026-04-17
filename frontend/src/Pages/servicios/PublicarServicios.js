/* ================================
   PUBLICAR SERVICIO
================================ */
const contactoInput = document.getElementById("contacto");

contactoInput.addEventListener("input", function () {

    let valor = contactoInput.value;

    // Si son solo números (teléfono)
    if (/^\d+$/.test(valor)) {

        if (valor.length > 10) {
            contactoInput.value = valor.slice(0, 10);
        }

    }

});

const formPublicar = document.getElementById("form-publicar-servicio");

formPublicar.addEventListener("submit", function (e) {

    e.preventDefault();

    /* ===== OBTENER VALORES ===== */

    const titulo = document.getElementById("titulo").value.trim();
    const descripcion = document.getElementById("descripcion").value.trim();
    const categoria = document.getElementById("categoria").value;
    const precio = document.getElementById("precio").value;
    const contacto = document.getElementById("contacto").value.trim();

    const modalidad = document.querySelector('input[name="modalidad"]:checked')?.value;
    const disponibilidad = document.querySelector('input[name="disponibilidad"]:checked')?.value;

    const proveedor = localStorage.getItem("usuarioId");

    let categoriaID = null;

    switch (categoria) {

        case "tutorias":
            categoriaID = 1;
            break;

        case "ensayos":
            categoriaID = 2;
            break;

        case "proyectos":
            categoriaID = 3;
            break;

        case "programacion":
            categoriaID = 4;
            break;

        case "diseno":
            categoriaID = 5;
            break;

        case "arriendo":
            categoriaID = 6;
            break;

        case "otros":
            categoriaID = 7;
            break;

        default:
            categoriaID = 7;
    }

    /* ===== VALIDACIÓN ===== */

    if (!titulo || !descripcion || !categoria || !precio || !contacto || !modalidad || !disponibilidad) {
        alert("❌ Completa todos los campos");
        return;
    }

    if (!proveedor) {
        alert("❌ Debes iniciar sesión para publicar un servicio");
        return;
    }


    /* ===== CONVERTIR MODALIDAD A INT ===== */

    let modalidadDB = 0;

    if (modalidad === "presencial") modalidadDB = 0;
    if (modalidad === "virtual") modalidadDB = 1;
    if (modalidad === "mixta") modalidadDB = 2;


    /* ===== CONVERTIR DISPONIBILIDAD A INT ===== */

    let disponibilidadDB = 0;

    if (disponibilidad === "semana") disponibilidadDB = 0;
    if (disponibilidad === "finesemana") disponibilidadDB = 1;
    if (disponibilidad === "siempre") disponibilidadDB = 2;



    /* ===== ICONO AUTOMÁTICO ===== */

    const mapaIconos = {
        tutorias: "📚",
        ensayos: "✍️",
        proyectos: "🗂️",
        programacion: "💻",
        diseno: "🎨",
        arriendo: "🏠",
        otros: "🌐"
    };

    const icono = mapaIconos[categoria] || "📌";


    /* ===== CREAR OBJETO ===== */

    const nuevoServicio = {

        id_proveedor: Number(proveedor),
        titulo: titulo,
        descripcion: descripcion,
        id_categoria: categoriaID,
        precio_hora: Number(precio),
        contacto: contacto,
        modalidad: modalidadDB,
        icono: icono,
        disponibilidad: disponibilidadDB

    };


    /* ===== ENVIAR AL PHP ===== */

    console.log("Enviando servicio...");
    console.log(nuevoServicio);

    fetch("http://localhost/api/crud/Servicios_Crud.php", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(nuevoServicio)
    })
        .then(async res => {

            // Verificar si el servidor respondió bien
            if (!res.ok) {
                throw new Error("Error HTTP: " + res.status);
            }

            // Intentar convertir a JSON
            const data = await res.json();
            return data;

        })
        .then(data => {

            console.log("RESPUESTA DEL SERVIDOR:", data);

            if (data.ok) {

                alert("✅ Servicio publicado correctamente");

                formPublicar.reset();

            } else {

                alert("❌ Error: " + (data.error || "No se pudo publicar"));

            }

        })
        .catch(err => {

            console.error("ERROR FETCH:", err);

            alert("❌ Error de conexión con el servidor");

        });
});