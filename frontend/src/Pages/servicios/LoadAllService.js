let servicios = [];
let mostrados = 0;
const cantidad = 8;

function cargarServicios() {

    fetch("http://localhost/api/crud/Servicios_Crud.php")
        .then(res => res.json())
        .then(data => {

            servicios = data.reverse(); // más recientes primero
            mostrarServicios();

        })
        .catch(err => console.error("Error cargando servicios:", err));

}

function mostrarServicios() {

    const contenedor = document.getElementById("contenedor-servicios");

    const nuevos = servicios.slice(mostrados, mostrados + cantidad);

    nuevos.forEach(servicio => {

        const estrellasTexto = typeof calcularEstrellas === 'function'
            ? calcularEstrellas(servicio.estrellas)
            : "☆☆☆☆☆ (0)";

        const numReseñas = servicio.estrellas ? servicio.estrellas.length : 0;

        let descripcion = servicio.descripcion;

        if (descripcion.length > 70) {
            descripcion = descripcion.substring(0, 70) + "...";
        }

        const tarjeta = `
        <a href="Servicio.html?id=${servicio.id_servicio}" class="card-servicio card-3d">
        <div class="card-icono card-icono-azul">${servicio.icono || "📌"}</div>
        <div class="card-body-custom">

            <span class="etiqueta et-azul">
            ${servicio.nombre_categoria || "Categoría no especificada"}
            </span>

            <p class="card-meta">
            ${servicio.universidad === 1
                ? "Universidad Popular del Cesar"
                : "Universidad no especificada"}
            </p>

            <h5>${servicio.titulo}</h5>

            <p class="texto-muted">
            ${descripcion}
            </p>

            <div class="card-autor">
                <div class="avatar avatar-azul">👤</div>
                <span class="texto-muted">
                ${servicio.proveedor || "Proveedor anónimo"}
                </span>
            </div>

            <div class="texto-fecha">
            ${servicio.fecha_publicacion || ""}
            </div>

            <div class="card-footer">
                <div>
                    <hr class="card-divider">
                    <div class="estrellas">${estrellasTexto}</div>
                    <div class="texto-muted">${numReseñas} reseñas</div>
                </div>

                <div class="precio">${servicio.precio_hora}$</div>
            </div>

        </div>
        </a>
        `;

        contenedor.innerHTML += tarjeta;

    });

    mostrados += cantidad;

    if (mostrados >= servicios.length) {
        document.getElementById("contenedor-boton").style.display = "none";
    }

}

document.getElementById("btn-mostrar-mas").addEventListener("click", mostrarServicios);

window.addEventListener("load", cargarServicios);


//Para ordenar servicios por filtro de categoria, nombre o descripcion. El resultado se muestra en la consola.

document.getElementById("ordenar-servicios").addEventListener("change", function () {

    const tipo = this.value;

    if (tipo === "Mejor calificados primero") {

        servicios.sort((a, b) => {
            return (b.estrellas || 0) - (a.estrellas || 0);
        });

    }

    if (tipo === "Más recientes") {

        servicios.sort((a, b) => {
            return new Date(b.fecha_publicacion) - new Date(a.fecha_publicacion);
        });

    }

    if (tipo === "Precio: menor a mayor") {

        servicios.sort((a, b) => {
            return a.precio_hora - b.precio_hora;
        });

    }

    if (tipo === "Precio: mayor a menor") {

        servicios.sort((a, b) => {
            return b.precio_hora - a.precio_hora;
        });

    }

    /* resetear lista */

    document.getElementById("contenedor-servicios").innerHTML = "";
    document.getElementById("total-resultados").innerText = servicios.length;

    mostrados = 0;

    mostrarServicios();

});