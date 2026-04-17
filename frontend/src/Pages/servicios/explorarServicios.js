console.log("explorarServicios cargado");

let serviciosTotales = [];
let serviciosFiltrados = [];
let categoriaActual = "todos";

/* =========================
   NORMALIZAR TEXTO
========================= */
function normalizarTexto(texto) {
    return (texto || "")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // quitar tildes
        .trim();
}

/* =========================
   CARGAR AL ENTRAR
========================= */
document.addEventListener("DOMContentLoaded", () => {
    cargarServiciosExplorar();
});

/* =========================
   TRAER SERVICIOS
========================= */
function cargarServiciosExplorar() {
    fetch("http://localhost/api/crud/Servicios_Crud.php")
        .then(response => response.json())
        .then(data => {
            serviciosTotales = data.reverse();
            serviciosFiltrados = [...serviciosTotales];

            renderizarServicios(serviciosFiltrados);
        })
        .catch(error => {
            console.error("Error cargando servicios:", error);

            const contenedor = document.getElementById("contenedor-explorar");
            contenedor.innerHTML = `
                <p class="texto-muted" style="text-align:center; width:100%;">
                    No se pudieron cargar los servicios.
                </p>
            `;
        });
}

/* =========================
   RENDERIZAR
========================= */
function renderizarServicios(lista) {
    const contenedor = document.getElementById("contenedor-explorar");
    const totalResultados = document.getElementById("total-resultados");

    contenedor.innerHTML = "";
    totalResultados.textContent = lista.length;

    if (lista.length === 0) {
        contenedor.innerHTML = `
            <p class="texto-muted" style="text-align:center; width:100%;">
                No se encontraron servicios con esos filtros.
            </p>
        `;
        return;
    }

    lista.forEach(servicio => {
        const estrellasTexto =
            typeof calcularEstrellas === "function"
                ? calcularEstrellas(servicio.estrellas)
                : "☆☆☆☆☆";

        const numReseñas = Array.isArray(servicio.estrellas)
            ? servicio.estrellas.length
            : 0;

        let descripcion = servicio.descripcion || "Sin descripción";

        if (descripcion.length > 90) {
            descripcion = descripcion.substring(0, 90) + "...";
        }

        const universidadTexto =
            servicio.universidad == 1
                ? "Universidad Popular del Cesar"
                : servicio.universidad || "Universidad no especificada";

        const tarjeta = `
            <a href="Servicio.html?id=${servicio.id_servicio}" class="card-servicio card-3d">
                <div class="card-icono card-icono-azul">
                    ${servicio.icono || "📌"}
                </div>

                <div class="card-body-custom">
                    <span class="etiqueta et-azul">
                        ${servicio.nombre_categoria || "Categoría no especificada"}
                    </span>

                    <p class="card-meta">${universidadTexto}</p>

                    <h5>${servicio.titulo || "Sin título"}</h5>

                    <p class="texto-muted">${descripcion}</p>

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

                        <div class="precio">
                            $${servicio.precio_hora || 0}
                        </div>
                    </div>
                </div>
            </a>
        `;

        contenedor.innerHTML += tarjeta;
    });
}

/* =========================
   FILTRO GLOBAL
========================= */
function ejecutarFiltro() {
    const textoBusqueda = normalizarTexto(
        document.getElementById("input-busqueda-global").value
    );

    serviciosFiltrados = serviciosTotales.filter(servicio => {
        const titulo = normalizarTexto(servicio.titulo);
        const descripcion = normalizarTexto(servicio.descripcion);
        const categoria = normalizarTexto(servicio.nombre_categoria);
        const proveedor = normalizarTexto(servicio.proveedor);

        const coincideTexto =
            titulo.includes(textoBusqueda) ||
            descripcion.includes(textoBusqueda) ||
            categoria.includes(textoBusqueda) ||
            proveedor.includes(textoBusqueda);

        const coincideCategoria =
            categoriaActual === "todos" ||
            categoria.includes(categoriaActual);

        return coincideTexto && coincideCategoria;
    });

    ordenarServicios();
}

/* =========================
   FILTRO CATEGORÍA
========================= */
function filtrarPorCategoria(categoria, botonSeleccionado) {
    categoriaActual = normalizarTexto(categoria);

    document.querySelectorAll("#filtros-categorias .chip").forEach(btn => {
        btn.classList.remove("activo");
    });

    botonSeleccionado.classList.add("activo");

    ejecutarFiltro();
}

/* =========================
   ESTRELLAS
========================= */
function calcularEstrellas(estrellas) {
    if (!Array.isArray(estrellas) || estrellas.length === 0) {
        return "☆☆☆☆☆";
    }

    const promedio =
        estrellas.reduce((acc, num) => acc + Number(num), 0) / estrellas.length;

    const completas = Math.round(promedio);

    return "★".repeat(completas) + "☆".repeat(5 - completas);
}
function obtenerPromedioEstrellas(estrellas) {
    if (!Array.isArray(estrellas) || estrellas.length === 0) {
        return 0;
    }

    const suma = estrellas.reduce((acc, num) => acc + Number(num), 0);
    return suma / estrellas.length;
}

/* =========================
   ORDENAR SERVICIOS
========================= */
function ordenarServicios() {
    const selectOrden = document.getElementById("orden-servicios");

    // seguridad: si no existe el select, no rompe
    if (!selectOrden) {
        renderizarServicios(serviciosFiltrados);
        return;
    }

    const criterio = selectOrden.value;

    serviciosFiltrados.sort((a, b) => {
        switch (criterio) {

            case "precio-menor":
                return Number(a.precio_hora || 0) - Number(b.precio_hora || 0);

            case "precio-mayor":
                return Number(b.precio_hora || 0) - Number(a.precio_hora || 0);

            case "rating-mayor":
                return obtenerPromedioEstrellas(b.estrellas) - obtenerPromedioEstrellas(a.estrellas);

            case "rating-menor":
                return obtenerPromedioEstrellas(a.estrellas) - obtenerPromedioEstrellas(b.estrellas);

            case "antiguos":
                return new Date(a.fecha_publicacion || 0) - new Date(b.fecha_publicacion || 0);

            case "recientes":
            default:
                return new Date(b.fecha_publicacion || 0) - new Date(a.fecha_publicacion || 0);
        }
    });

    renderizarServicios(serviciosFiltrados);
}